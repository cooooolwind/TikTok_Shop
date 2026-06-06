import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VideoSlice } from './video-slice.entity';

export type MaterialType = 'image' | 'video';
export type MaterialCategory = 'product' | 'scene' | 'model' | 'other';
export type MaterialStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', length: 64 })
  merchantId: string;

  @Column({ type: 'enum', enum: ['image', 'video'] })
  type: MaterialType;

  @Column({ length: 1024 })
  url: string;

  @Column({ name: 'thumbnail_url', length: 1024, nullable: true })
  thumbnailUrl: string;

  @Column({ length: 512, default: '' })
  name: string;

  @Column({ length: 512 })
  filename: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ name: 'mime_type', length: 128, nullable: true })
  mimeType: string;

  @Column({
    type: 'enum',
    enum: ['product', 'scene', 'model', 'other'],
    default: 'other',
  })
  category: MaterialCategory;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ name: 'source_declaration', length: 64 })
  sourceDeclaration: string;

  @Column({ name: 'ai_tags', type: 'jsonb', default: () => "'[]'" })
  aiTags: string[];

  @Column({ name: 'ai_description', type: 'text', nullable: true })
  aiDescription: string;

  @Column({ name: 'ai_embedding', type: 'vector', length: 2048, nullable: true })
  aiEmbedding: number[];

  @Column({
    type: 'enum',
    enum: ['uploaded', 'processing', 'ready', 'failed'],
    default: 'uploaded',
  })
  status: MaterialStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => VideoSlice, (slice) => slice.material, { cascade: true })
  slices: VideoSlice[];
}
