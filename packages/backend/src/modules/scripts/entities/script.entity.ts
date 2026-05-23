import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Scene } from './scene.entity';

export type ScriptMode = 'template' | 'imitation' | 'free';
export type ScriptStatus = 'generating' | 'draft' | 'failed' | 'confirmed';

interface ProductInfo {
  name: string;
  description: string;
  category: string;
  selling_points: string[];
  target_audience?: string;
  price?: string;
  images?: string[];
  link?: string;
}

@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', length: 64 })
  merchantId: string;

  @Column({ name: 'product_info', type: 'jsonb' })
  productInfo: ProductInfo;

  @Column({ name: 'template_id', type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null;

  @Column({ name: 'source_material_ids', type: 'jsonb', default: () => "'[]'" })
  sourceMaterialIds: string[];

  @Column({ name: 'generation_task_id', type: 'varchar', nullable: true })
  generationTaskId: string | null;

  @Column({ name: 'generation_error', type: 'text', nullable: true })
  generationError: string | null;

  @Column({ type: 'enum', enum: ['template', 'imitation', 'free'] })
  mode: ScriptMode;

  @Column({ name: 'narrative_framework', type: 'text', nullable: true })
  narrativeFramework: string;

  @Column({ name: 'visual_style', length: 512, nullable: true })
  visualStyle: string;

  @Column({ name: 'total_duration', type: 'float', default: 15 })
  totalDuration: number;

  @Column({ type: 'enum', enum: ['generating', 'draft', 'failed', 'confirmed'], default: 'draft' })
  status: ScriptStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Scene, (scene) => scene.script)
  scenes: Scene[];
}
