import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Script } from '../modules/scripts/entities/script.entity';
import { Scene } from '../modules/scripts/entities/scene.entity';
import { GenerationTask } from '../modules/generation/entities/generation-task.entity';
import { Video } from '../modules/generation/entities/video.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { ScriptGenerationProcessor } from './processors/script-generation.processor';
import { VideoGenerationProcessor } from './processors/video-generation.processor';
import { QUEUES } from './queues';

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
    TypeOrmModule.forFeature([Script, Scene, GenerationTask, Video]),
    WebsocketModule,
  ],
  providers: [ScriptGenerationProcessor, VideoGenerationProcessor],
  exports: [BullModule],
})
export class TasksModule {}
