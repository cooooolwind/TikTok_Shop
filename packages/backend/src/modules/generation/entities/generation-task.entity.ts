import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Script } from '../../scripts/entities/script.entity';
import { Video } from './video.entity';

export type GenerationStatus = 'queued' | 'processing' | 'done' | 'failed';

interface TaskProgress {
  current_step: number;
  total_steps: number;
  step_name: string;
  percentage: number;
  message: string;
  estimated_remaining: number;
}

interface TaskResult {
  video_url: string;
  thumbnail_url: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  file_size: number;
}

interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
}

@Entity('generation_tasks')
export class GenerationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @Column({
    type: 'enum',
    enum: ['queued', 'processing', 'done', 'failed'],
    default: 'queued',
  })
  status: GenerationStatus;

  @Column({ type: 'jsonb', nullable: true })
  progress: TaskProgress;

  @Column({ type: 'jsonb', nullable: true })
  result: TaskResult;

  @Column({ type: 'jsonb', nullable: true })
  error: TaskError;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @ManyToOne(() => Script)
  @JoinColumn({ name: 'script_id' })
  script: Script;

  @OneToOne(() => Video, (video) => video.task)
  video: Video;
}
