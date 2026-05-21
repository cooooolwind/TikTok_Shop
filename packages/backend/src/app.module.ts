import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { configModuleOptions } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';

import { MaterialsModule } from './modules/materials/materials.module';
import { ReferencesModule } from './modules/references/references.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { GenerationModule } from './modules/generation/generation.module';
import { TtsModule } from './modules/tts/tts.module';
import { BgmModule } from './modules/bgm/bgm.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SystemModule } from './modules/system/system.module';

import { AiModule } from './ai/ai.module';
import { TasksModule } from './tasks/tasks.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    CommonModule,
    MaterialsModule,
    ReferencesModule,
    TemplatesModule,
    ScriptsModule,
    GenerationModule,
    TtsModule,
    BgmModule,
    AnalyticsModule,
    SystemModule,
    AiModule,
    TasksModule,
    WebsocketModule,
  ],
})
export class AppModule {}
