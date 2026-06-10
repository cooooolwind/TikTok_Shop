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

type TaskProgressPhase =
  | 'queued'
  | 'prepare'
  | 'build_segments'
  | 'submit_segment'
  | 'generate_segment'
  | 'retry_segment'
  | 'persist_result'
  | 'done'
  | 'failed';

type TaskErrorCategory =
  | 'network'
  | 'rate_limit'
  | 'timeout'
  | 'moderation'
  | 'provider'
  | 'export'
  | 'unknown';

interface TaskProgress {
  current_step: number;
  total_steps: number;
  step_name: string;
  percentage: number;
  message: string;
  estimated_remaining: number;
  phase?: TaskProgressPhase;
  phase_label?: string;
  segment_index?: number;
  segment_total?: number;
  elapsed_seconds?: number;
  detail?: string;
}

interface TaskResult {
  video_url: string;
  thumbnail_url: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  file_size: number;
  render_engine?: 'ffmpeg' | 'remotion';
  continuity_warning?: string;
  stitching_warning?: string;
  segments?: {
    index: number;
    video_url: string;
    thumbnail_url: string;
    duration: number;
    resolution: string;
    aspect_ratio: string;
    scene_orders: number[];
    input_frame_url?: string;
    continuity_source?:
      | 'generated_first_frame'
      | 'product_image'
      | 'previous_last_frame'
      | 'text_only';
    status?: 'pending' | 'submitted' | 'running' | 'succeeded' | 'failed' | 'skipped';
    provider_task_id?: string;
    error?: TaskError;
    started_at?: string;
    completed_at?: string;
  }[];
}

interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
  category?: TaskErrorCategory;
  segment_index?: number;
  user_action?: string;
}

@Entity('generation_tasks')
export class GenerationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  @Column({
    type: 'enum',
    enum: ['queued', 'processing', 'done', 'failed'],
    default: 'queued',
  })
  status: GenerationStatus;

  @Column({ type: 'jsonb', nullable: true })
  progress: TaskProgress | null;

  @Column({ type: 'jsonb', nullable: true })
  result: TaskResult | null;

  @Column({ type: 'jsonb', nullable: true })
  error: TaskError | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ManyToOne(() => Script)
  @JoinColumn({ name: 'script_id' })
  script: Script;

  @OneToOne(() => Video, (video) => video.task)
  video: Video;
}
