import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 256 })
  name: string;

  @Column({ type: 'text' })
  strategy: string;

  @Column({ type: 'jsonb' })
  factors: Record<string, string>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  constraints: string[];

  @Column({ name: 'applicable_categories', type: 'jsonb', default: () => "'[]'" })
  applicableCategories: string[];

  @Column({ name: 'derived_from', type: 'jsonb', default: () => "'[]'" })
  derivedFrom: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
