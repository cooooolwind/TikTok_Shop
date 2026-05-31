import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { Brackets, Repository } from 'typeorm';
import { Material } from './entities/material.entity';
import { VideoSlice } from './entities/video-slice.entity';
import { MaterialListQueryDto } from './dto/material-list-query.dto';
import { SimilarSearchDto } from './dto/similar-search.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { QUEUES } from '../../tasks/queues';

type MaterialResponse = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url: string;
  name: string;
  filename: string;
  size: number;
  category: string;
  tags: string[];
  source_declaration: string;
  ai_tags: string[];
  ai_description: string;
  duration?: number;
  resolution?: { width: number; height: number };
  status: string;
  created_at: string;
  updated_at: string;
};

type MaterialDetailResponse = MaterialResponse & {
  slices?: ReturnType<MaterialsService['toSliceResponse']>[];
  metadata: Record<string, unknown>;
};

const DEFAULT_MERCHANT_ID = 'default';
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SORT_FIELD_MAP: Record<string, string> = {
  created_at: 'material.createdAt',
  updated_at: 'material.updatedAt',
  filename: 'material.filename',
  size: 'material.size',
  status: 'material.status',
};

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(VideoSlice)
    private readonly videoSlicesRepository: Repository<VideoSlice>,
    @InjectQueue(QUEUES.MATERIAL_ANALYSIS)
    private readonly analysisQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async upload(file: Express.Multer.File | undefined, dto: UploadMaterialDto) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const type = this.getMaterialType(file);
    this.validateFile(file, type);

    const uploadDir = this.getMaterialsUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const safeExtension = this.getFileExtension(file);
    const storedFilename = `${Date.now()}-${randomUUID()}${safeExtension}`;
    const storedPath = join(uploadDir, storedFilename);

    if (file.path) {
      await fs.rename(file.path, storedPath);
    } else if (file.buffer) {
      await fs.writeFile(storedPath, file.buffer);
    } else {
      throw new BadRequestException('file content is missing');
    }

    const url = `/uploads/materials/${storedFilename}`;
    const originalFilename = this.normalizeFilename(file.originalname);
    const material = this.materialsRepository.create({
      merchantId: DEFAULT_MERCHANT_ID,
      type,
      url,
      thumbnailUrl: type === 'image' ? url : '',
      name: dto.name || originalFilename,
      filename: originalFilename,
      size: file.size,
      mimeType: file.mimetype,
      category: dto.category ?? 'other',
      tags: dto.tags ?? [],
      sourceDeclaration: dto.source_declaration,
      aiTags: [],
      aiDescription: '',
      status: 'uploaded',
      metadata: {
        format: safeExtension.replace('.', ''),
        mime_type: file.mimetype,
      },
    });

    const saved = await this.materialsRepository.save(material);
    this.logger.log(`Uploaded material ${saved.id}: ${saved.filename} (name: ${saved.name})`);

    // 自动触发多模态分析任务
    try {
      await this.analyze(saved.id);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to trigger auto-analysis for material ${saved.id}: ${error}`);
    }

    return {
      id: saved.id,
      name: saved.name,
      filename: saved.filename,
      type: saved.type,
      url: saved.url,
      size: Number(saved.size),
      status: saved.status,
    };
  }

  async findAll(query: MaterialListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.materialsRepository
      .createQueryBuilder('material')
      .where('material.merchantId = :merchantId', { merchantId: DEFAULT_MERCHANT_ID });

    if (query.type) {
      qb.andWhere('material.type = :type', { type: query.type });
    }
    if (query.category) {
      qb.andWhere('material.category = :category', { category: query.category });
    }
    if (query.status) {
      qb.andWhere('material.status = :status', { status: query.status });
    }
    if (query.tags?.length) {
      qb.andWhere('material.tags @> :tags::jsonb', { tags: JSON.stringify(query.tags) });
    }
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('material.filename ILIKE :keyword', { keyword })
            .orWhere('material.aiDescription ILIKE :keyword', { keyword })
            .orWhere("material.tags::text ILIKE :keyword", { keyword })
            .orWhere("material.aiTags::text ILIKE :keyword", { keyword });
        }),
      );
    }

    const sortField = query.sortBy ? SORT_FIELD_MAP[query.sortBy] : SORT_FIELD_MAP.created_at;
    qb.orderBy(sortField ?? SORT_FIELD_MAP.created_at, (query.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((item) => this.toMaterialResponse(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<MaterialDetailResponse> {
    const material = await this.materialsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
      relations: { slices: true },
    });
    if (!material) {
      throw new NotFoundException('material not found');
    }
    return this.toMaterialDetailResponse(material);
  }

  async update(id: string, dto: UpdateMaterialDto) {
    const material = await this.materialsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
    });
    if (!material) {
      throw new NotFoundException('material not found');
    }

    if (dto.name !== undefined) material.name = dto.name;
    if (dto.category !== undefined) material.category = dto.category;
    if (dto.tags !== undefined) material.tags = dto.tags;

    const saved = await this.materialsRepository.save(material);
    return this.toMaterialResponse(saved);
  }

  async remove(id: string) {
    const material = await this.materialsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
    });
    if (!material) {
      throw new NotFoundException('material not found');
    }

    await this.materialsRepository.remove(material);
    await this.deleteLocalFile(material.url);
    return { message: 'deleted' };
  }

  async batchRemove(ids: string[]) {
    const materials = await this.materialsRepository
      .createQueryBuilder('material')
      .where('material.merchantId = :merchantId', { merchantId: DEFAULT_MERCHANT_ID })
      .andWhere('material.id IN (:...ids)', { ids })
      .getMany();

    if (materials.length === 0) {
      return { message: 'deleted', deleted: 0 };
    }

    await this.materialsRepository.remove(materials);
    await Promise.all(materials.map((material) => this.deleteLocalFile(material.url)));
    return { message: 'deleted', deleted: materials.length };
  }

  async analyze(id: string) {
    const material = await this.materialsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
    });
    if (!material) {
      throw new NotFoundException('material not found');
    }

    material.status = 'processing';
    await this.materialsRepository.save(material);

    const job = await this.analysisQueue.add('analyze', { materialId: material.id });

    return { task_id: job.id, status: 'queued' as const };
  }

  async findSlices(id: string) {
    await this.ensureMaterialExists(id);
    const slices = await this.videoSlicesRepository.find({
      where: { materialId: id },
      order: { startTime: 'ASC' },
    });
    return slices.map((slice) => this.toSliceResponse(slice));
  }

  async searchSimilar(dto: SimilarSearchDto) {
    const query = dto.query.trim().toLowerCase();
    const limit = dto.limit ?? 10;
    const qb = this.materialsRepository
      .createQueryBuilder('material')
      .where('material.merchantId = :merchantId', { merchantId: DEFAULT_MERCHANT_ID });

    if (dto.type) {
      qb.andWhere('material.type = :type', { type: dto.type });
    }

    const candidates = await qb.orderBy('material.createdAt', 'DESC').take(200).getMany();
    return candidates
      .map((material) => ({
        material,
        score: this.calculateTextScore(material, query),
      }))
      .filter((result) => result.score >= (dto.threshold ?? 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((result) => ({
        material: this.toMaterialResponse(result.material),
        score: result.score,
      }));
  }

  private async ensureMaterialExists(id: string) {
    const exists = await this.materialsRepository.exist({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
    });
    if (!exists) {
      throw new NotFoundException('material not found');
    }
  }

  private getMaterialType(file: Express.Multer.File): 'image' | 'video' {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) return 'image';
    if (VIDEO_MIME_TYPES.includes(file.mimetype)) return 'video';
    throw new BadRequestException('unsupported file type');
  }

  private validateFile(file: Express.Multer.File, type: 'image' | 'video') {
    const storage = this.configService.get('storage') as
      | { maxImageSize?: number; maxVideoSize?: number }
      | undefined;
    const maxSize = type === 'image' ? storage?.maxImageSize ?? 20 * 1024 * 1024 : storage?.maxVideoSize ?? 500 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`${type} file is too large`);
    }
  }

  private getFileExtension(file: Express.Multer.File) {
    const extension = extname(this.normalizeFilename(file.originalname)).toLowerCase();
    if (extension) return extension;
    const fallback: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
    };
    return fallback[file.mimetype] ?? '';
  }

  private getMaterialsUploadDir() {
    const storage = this.configService.get('storage') as { localPath?: string } | undefined;
    return join(storage?.localPath ?? join(process.cwd(), 'uploads'), 'materials');
  }

  private async deleteLocalFile(url: string) {
    const filename = basename(url);
    if (!filename) return;
    try {
      await fs.unlink(join(this.getMaterialsUploadDir(), filename));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to delete local material file ${filename}: ${(error as Error).message}`);
      }
    }
  }

  private calculateTextScore(material: Material, query: string) {
    if (!query) return 0.5;
    const haystack = [
      material.filename,
      material.aiDescription,
      ...(material.tags ?? []),
      ...(material.aiTags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack) return 0;
    if (haystack.includes(query)) return 1;

    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length) return 0;
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    return Number((matched / tokens.length).toFixed(2));
  }

  private toMaterialDetailResponse(material: Material): MaterialDetailResponse {
    return {
      ...this.toMaterialResponse(material),
      slices: material.slices?.map((slice) => this.toSliceResponse(slice)) ?? [],
      metadata: material.metadata ?? { format: '' },
    };
  }

  private toMaterialResponse(material: Material): MaterialResponse {
    const metadata = material.metadata ?? {};
    return {
      id: material.id,
      type: material.type,
      url: material.url,
      thumbnail_url: material.thumbnailUrl ?? '',
      name: material.name || this.normalizeFilename(material.filename),
      filename: this.normalizeFilename(material.filename),
      size: Number(material.size),
      category: material.category,
      tags: material.tags ?? [],
      source_declaration: material.sourceDeclaration,
      ai_tags: material.aiTags ?? [],
      ai_description: material.aiDescription ?? '',
      duration: typeof metadata.duration === 'number' ? metadata.duration : undefined,
      resolution: this.getResolution(metadata),
      status: material.status,
      created_at: material.createdAt.toISOString(),
      updated_at: material.updatedAt.toISOString(),
    };
  }

  private toSliceResponse(slice: VideoSlice) {
    return {
      id: slice.id,
      start_time: slice.startTime,
      end_time: slice.endTime,
      description: slice.description ?? '',
      thumbnail_url: slice.thumbnailUrl ?? '',
      tags: slice.tags ?? [],
    };
  }

  private getResolution(metadata: Record<string, unknown>) {
    const resolution = metadata.resolution as { width?: unknown; height?: unknown } | undefined;
    if (typeof resolution?.width === 'number' && typeof resolution.height === 'number') {
      return { width: resolution.width, height: resolution.height };
    }
    return undefined;
  }

  private normalizeFilename(filename: string) {
    if (!filename) return filename;
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    return decoded.includes('�') ? filename : decoded;
  }
}
