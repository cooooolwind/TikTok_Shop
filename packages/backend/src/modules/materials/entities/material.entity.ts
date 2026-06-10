import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import type { MaterialCategory } from '@aigc/shared-types';
import { VideoSlice } from './video-slice.entity';
import { MaterialAnalysis } from './material-analysis.entity';

export type MaterialType = 'image' | 'video';
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
    enum: [
      'product',
      'scene',
      'model',
      'apparel_underwear',
      'shoes_bags',
      'food_beverage',
      'beauty_skincare',
      'sports_outdoors',
      'daily_necessities',
      'home_textiles',
      'maternity_baby',
      'health_care',
      '3c_digital',
      'kitchen_appliances',
      'furniture_building',
      'jewelry_accessories',
      'toys_instruments',
      'books_education',
      'gifts_culture',
      'fresh_produce',
      'flowers_plants',
      'pet_supplies',
      'auto_motorcycle',
      'watches_accessories',
      'local_life',
      'second_hand',
      'luxury',
      'raw_materials_packaging',
      'other',
    ],
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

  @Column({ name: 'source_platform', length: 64, nullable: true })
  sourcePlatform: string;

  @Column({
    type: 'enum',
    enum: ['uploaded', 'processing', 'ready', 'failed'],
    default: 'uploaded',
  })
  status: MaterialStatus;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => VideoSlice, (slice) => slice.material, { cascade: true })
  slices: VideoSlice[];

  @OneToOne(() => MaterialAnalysis, analysis => analysis.material, { cascade: true })
  analysis: MaterialAnalysis;
}
