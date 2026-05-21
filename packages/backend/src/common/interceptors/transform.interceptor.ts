import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 将控制器返回的数据包装为 ApiResponse<T> 格式 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data: data ?? null,
        message: 'success',
      })),
    );
  }
}
