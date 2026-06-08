import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type AnalysisStatus = 'fetching' | 'uploading' | 'analyzing' | 'done' | 'failed';

interface ReferenceAnalysis {
  hook: string;
  selling_points: string[];
  style: string;
  duration: number;
  storyboard: { order: number; duration: number; description: string; camera_motion: string; visual_elements: string[] }[];
}

@Entity('reference_videos')
export class ReferenceVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_url', length: 2048, nullable: true })
  sourceUrl: string;

  @Column({ name: 'source_platform', length: 64, nullable: true })
  sourcePlatform: string;

  @Column({ length: 128, nullable: true })
  category: string;

  @Column({ name: 'source_declaration', length: 64 })
  sourceDeclaration: string;

  @Column({
    name: 'analysis_status',
    type: 'enum',
    enum: ['fetching', 'uploading', 'analyzing', 'done', 'failed'],
    default: 'fetching',
  })
  analysisStatus: AnalysisStatus;

  @Column({ type: 'jsonb', nullable: true })
  analysis: ReferenceAnalysis;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
