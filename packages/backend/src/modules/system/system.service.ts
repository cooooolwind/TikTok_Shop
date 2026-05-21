import { Injectable } from '@nestjs/common';

@Injectable()
export class SystemService {
  health() {
    return {
      status: 'ok' as const,
      version: '1.0.0',
      services: {
        database: 'ok',
        redis: 'ok',
        volcano_api: 'ok',
      },
    };
  }

  upload() {
    return { url: 'stub', filename: 'stub', size: 0 };
  }
}
