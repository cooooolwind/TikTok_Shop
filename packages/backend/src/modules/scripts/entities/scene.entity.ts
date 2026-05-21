import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Script } from './script.entity';

@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @Column({ name: 'order_num', type: 'int' })
  order: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'camera_motion', length: 256, nullable: true })
  cameraMotion: string;

  @Column({ type: 'float', default: 3 })
  duration: number;

  @Column({ type: 'text', nullable: true })
  dialogue: string;

  @Column({ name: 'bgm_style', length: 128, nullable: true })
  bgmStyle: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string;

  @Column({ name: 'visual_prompt', type: 'text', nullable: true })
  visualPrompt: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  constraints: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Script, (script) => script.scenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'script_id' })
  script: Script;
}
