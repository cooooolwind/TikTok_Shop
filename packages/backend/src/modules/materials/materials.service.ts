import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  upload() {
    this.logger.log('upload called');
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

  batchRemove() {
    return { message: 'deleted' };
  }

  analyze(id: string) {
    return { task_id: 'stub', status: 'queued' as const };
  }

  findSlices(id: string) {
    return [];
  }

  searchSimilar() {
    return [];
  }
}
