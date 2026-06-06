import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Material } from './material.entity';

@Entity('video_slices')
export class VideoSlice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'material_id' })
  materialId: string;

  @Column({ name: 'start_time', type: 'float' })
  startTime: number;

  @Column({ name: 'end_time', type: 'float' })
  endTime: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'thumbnail_url', length: 1024, nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'vector', length: 2048, nullable: true })
  embedding: number[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Material, (material) => material.slices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: Material;
}
