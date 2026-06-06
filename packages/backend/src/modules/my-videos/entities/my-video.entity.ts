import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { TemplateGenerateRequest, TemplateGenerateResult } from '@aigc/shared-types';

@Entity('my_videos')
export class MyVideoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', length: 64, default: 'default' })
  merchantId: string;

  @Column({ name: 'product_name', length: 256 })
  productName: string;

  @Column({ name: 'template_id', length: 128 })
  templateId: string;

  @Column({ name: 'template_name', length: 256 })
  templateName: string;

  @Column({ type: 'varchar', length: 32, default: 'saved' })
  status: 'generated' | 'saved';

  @Column({ name: 'product_info', type: 'jsonb' })
  productInfo: TemplateGenerateRequest;

  @Column({ type: 'jsonb' })
  result: TemplateGenerateResult;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
