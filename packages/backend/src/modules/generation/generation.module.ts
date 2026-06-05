import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationTask } from './entities/generation-task.entity';
import { Video } from './entities/video.entity';
import { Script } from '../scripts/entities/script.entity';
import { QUEUES } from '../../tasks/queues';
import { RemotionRenderingService } from './remotion-rendering.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerationTask, Video, Script]),
    BullModule.registerQueue({ name: QUEUES.VIDEO_GENERATION }),
  ],
  controllers: [GenerationController],
  providers: [GenerationService, RemotionRenderingService],
  exports: [GenerationService],
})
export class GenerationModule {}
