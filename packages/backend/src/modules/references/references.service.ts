import { Injectable } from '@nestjs/common';

@Injectable()
export class ReferencesService {
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
    return { id, message: 'deleted' };
  }
}
