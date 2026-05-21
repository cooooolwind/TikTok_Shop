import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
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
  ],
  exports: [BullModule],
})
export class TasksModule {}
