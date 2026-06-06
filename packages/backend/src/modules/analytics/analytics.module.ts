import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GenerationTask } from '../generation/entities/generation-task.entity';
import { Material } from '../materials/entities/material.entity';
import { Script } from '../scripts/entities/script.entity';
import { Template } from '../templates/entities/template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GenerationTask, Material, Script, Template])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
