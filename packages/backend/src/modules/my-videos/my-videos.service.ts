import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MyVideo, SaveMyVideoRequest } from '@aigc/shared-types';
import { MyVideoEntity } from './entities/my-video.entity';

const DEFAULT_MERCHANT_ID = 'default';

@Injectable()
export class MyVideosService {
  constructor(@InjectRepository(MyVideoEntity) private readonly myVideosRepository: Repository<MyVideoEntity>) {}

  async create(data: SaveMyVideoRequest): Promise<MyVideo> {
    const video = this.myVideosRepository.create({
      merchantId: DEFAULT_MERCHANT_ID,
      productName: data.product_info.productName,
      templateId: data.template_id,
      templateName: data.template_name,
      status: 'saved',
      productInfo: data.product_info,
      result: data.result,
    });
    return this.toResponse(await this.myVideosRepository.save(video));
  }

  async findAll(): Promise<MyVideo[]> {
    const videos = await this.myVideosRepository.find({
      where: { merchantId: DEFAULT_MERCHANT_ID },
      order: { createdAt: 'DESC' },
    });
    return videos.map((video) => this.toResponse(video));
  }

  private toResponse(video: MyVideoEntity): MyVideo {
    return {
      id: video.id,
      product_name: video.productName,
      template_id: video.templateId,
      template_name: video.templateName,
      status: video.status,
      product_info: video.productInfo,
      result: video.result,
      created_at: video.createdAt.toISOString(),
    };
  }
}
