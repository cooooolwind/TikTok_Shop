import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationTask } from './entities/generation-task.entity';
import { Video } from './entities/video.entity';
import { Script } from '../scripts/entities/script.entity';
import { Scene } from '../scripts/entities/scene.entity';
import { Material } from '../materials/entities/material.entity';
import { QUEUES } from '../../tasks/queues';
import { RemotionRenderingService } from './remotion-rendering.service';
import { SubtitlesService } from './subtitles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerationTask, Video, Script, Scene, Material]),
    BullModule.registerQueue({ name: QUEUES.VIDEO_GENERATION }),
  ],
  controllers: [GenerationController],
  providers: [GenerationService, RemotionRenderingService, SubtitlesService],
  exports: [GenerationService],
})
export class GenerationModule {}
