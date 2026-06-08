import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Script } from '../modules/scripts/entities/script.entity';
import { Scene } from '../modules/scripts/entities/scene.entity';
import { Material } from '../modules/materials/entities/material.entity';
import { VideoSlice } from '../modules/materials/entities/video-slice.entity';
import { GenerationTask } from '../modules/generation/entities/generation-task.entity';
import { Video } from '../modules/generation/entities/video.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { MaterialsModule } from '../modules/materials/materials.module';
import { ScriptGenerationProcessor } from './processors/script-generation.processor';
import { VideoGenerationProcessor } from './processors/video-generation.processor';
import { MaterialAnalysisProcessor } from './processors/material-analysis.processor';
import { VideoStitchingService } from './services/video-stitching.service';
import { QUEUES } from './queues';

import { ReferenceVideo } from '../modules/references/entities/reference-video.entity';
import { ReferenceAnalysisProcessor } from './processors/reference-analysis.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('bull')!,
    }),
    BullModule.registerQueue(
      { name: QUEUES.MATERIAL_ANALYSIS },
      { name: QUEUES.SCRIPT_GENERATION },
      { name: QUEUES.VIDEO_GENERATION },
      { name: QUEUES.REFERENCE_ANALYSIS },
    ),
    TypeOrmModule.forFeature([Script, Scene, Material, VideoSlice, GenerationTask, Video, ReferenceVideo]),
    WebsocketModule,
    MaterialsModule,
  ],
  providers: [
    ScriptGenerationProcessor,
    VideoGenerationProcessor,
    MaterialAnalysisProcessor,
    ReferenceAnalysisProcessor,
    VideoStitchingService,
  ],
  exports: [BullModule, VideoStitchingService],
})
export class TasksModule {}
