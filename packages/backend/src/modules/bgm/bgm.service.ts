import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BgmService {
  private readonly logger = new Logger(BgmService.name);

  findAll() {
    return [];
  }
}
