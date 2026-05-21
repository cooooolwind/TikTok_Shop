import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ReferencesService {
  private readonly logger = new Logger(ReferencesService.name);

  create() {
    return { message: 'not implemented' };
  }

  findAll() {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  findOne(id: string) {
    return { id, message: 'not implemented' };
  }

  remove(id: string) {
    return { message: 'deleted' };
  }
}
