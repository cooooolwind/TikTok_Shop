import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ReferenceVideo } from './entities/reference-video.entity';
import { CreateReferenceDto, UploadReferenceDto } from './dto/references.dto';

@Injectable()
export class ReferencesService {
  constructor(
    @InjectRepository(ReferenceVideo)
    private readonly referenceRepository: Repository<ReferenceVideo>,
    @InjectQueue('reference-analysis') private readonly analysisQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateReferenceDto) {
    const ref = this.referenceRepository.create({
      sourceUrl: dto.source_url,
      sourcePlatform: dto.source_platform,
      category: dto.category,
      sourceDeclaration: dto.source_declaration,
      analysisStatus: 'fetching',
    });
    await this.referenceRepository.save(ref);

    // 将解析任务放入队列
    await this.analysisQueue.add('analyze-reference', { referenceId: ref.id });

    return ref;
  }

  async upload(file: Express.Multer.File, dto: UploadReferenceDto) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const storage = this.configService.get('storage') as { localPath: string };
    const uploadDir = path.join(storage.localPath, 'references');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 移动文件
    const finalPath = path.join(uploadDir, file.filename);
    fs.renameSync(file.path, finalPath);

    // 对于本地文件，我们将其路径保存至 sourceUrl，或者可以通过静态服务提供
    // 此处简化，以 /uploads/references/... 形式存储
    const relativeUrl = `/uploads/references/${file.filename}`;

    const ref = this.referenceRepository.create({
      sourceUrl: relativeUrl,
      sourcePlatform: 'local_upload',
      category: dto.category,
      sourceDeclaration: dto.source_declaration,
      analysisStatus: 'fetching',
    });
    await this.referenceRepository.save(ref);

    // 将解析任务放入队列
    await this.analysisQueue.add('analyze-reference', { referenceId: ref.id });

    return ref;
  }

  async findAll() {
    const [items, total] = await this.referenceRepository.findAndCount({
      order: { createdAt: 'DESC' },
    });
    return { items, total, page: 1, pageSize: items.length, totalPages: 1 };
  }

  async findOne(id: string) {
    const ref = await this.referenceRepository.findOne({ where: { id } });
    if (!ref) {
      throw new NotFoundException(`Reference video ${id} not found`);
    }
    return ref;
  }

  async remove(id: string) {
    const ref = await this.findOne(id);
    await this.referenceRepository.remove(ref);
    return { id, message: 'deleted' };
  }
}
