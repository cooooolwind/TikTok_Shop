import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { GenerationTask } from './generation-task.entity';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', unique: true })
  taskId: string;

  @Column({ name: 'merchant_id', length: 64 })
  merchantId: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @Column({ length: 1024 })
  url: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 1024, nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'float', nullable: true })
  duration: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  resolution: string | null;

  @Column({ name: 'aspect_ratio', type: 'varchar', length: 16, nullable: true })
  aspectRatio: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number | null;

  @Column({ name: 'export_formats', type: 'jsonb', default: () => "'[]'" })
  exportFormats: Record<string, unknown>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => GenerationTask, (task) => task.video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: GenerationTask;
}
