import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class MockProxyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.MOCK_DASHBOARD !== 'false') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    
    // Only proxy external metrics (Cost, Conversion, Strategy, Attribution)
    const isExternalMetric = 
      req.path.includes('/cost/') || 
      req.path.includes('/conversion/') || 
      req.path.includes('/strategy/') || 
      req.path.includes('/attribution');

    if (!isExternalMetric) {
      return next.handle();
    }

    const baseUrl = process.env.STATISTIC_API_URL;

    if (!baseUrl) {
      throw new HttpException(
        'STATISTIC_API_URL must be configured when MOCK_DASHBOARD is false',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Proxy the request to the external API
    // req.originalUrl contains the full path including the query string (e.g., /api/v1/analytics/overview?...)
    const url = new URL(req.originalUrl, baseUrl);

    return from(
      fetch(url.toString(), {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || '',
        },
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new HttpException(
              `External Analytics API error: ${res.statusText}`,
              res.status,
            );
          }
          const json = (await res.json()) as any;
          // Extract data so the local TransformInterceptor can re-wrap it into standard format
          return json.data !== undefined ? json.data : json;
        })
        .catch((err) => {
          if (err instanceof HttpException) throw err;
          throw new HttpException(
            `Failed to fetch from external API: ${err.message}`,
            HttpStatus.BAD_GATEWAY,
          );
        }),
    );
  }
}
