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
export type ScriptStatus = 'draft' | 'confirmed';

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

  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'enum', enum: ['template', 'imitation', 'free'] })
  mode: ScriptMode;

  @Column({ name: 'narrative_framework', type: 'text', nullable: true })
  narrativeFramework: string;

  @Column({ name: 'visual_style', length: 512, nullable: true })
  visualStyle: string;

  @Column({ name: 'total_duration', type: 'float', default: 15 })
  totalDuration: number;

  @Column({ type: 'enum', enum: ['draft', 'confirmed'], default: 'draft' })
  status: ScriptStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Scene, (scene) => scene.script, { cascade: true })
  scenes: Scene[];
}
