import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Material } from './material.entity';

@Entity('material_analysis')
export class MaterialAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Material, material => material.analysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ name: 'material_id' })
  materialId: string;

  @Column({ type: 'text', nullable: true })
  hook: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  style: string;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ name: 'selling_points', type: 'jsonb', default: () => "'[]'" })
  sellingPoints: string[];

  @Column({ type: 'jsonb', nullable: true })
  storyboard: { order: number; duration: number; description: string; camera_motion: string; visual_elements: string[] }[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
