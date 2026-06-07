import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';

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
import { MyVideosModule } from './modules/my-videos/my-videos.module';

import { AiModule } from './ai/ai.module';
import { TasksModule } from './tasks/tasks.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const storage = config.get('storage') as { localPath: string };
        return [
          {
            rootPath: storage.localPath,
            serveRoot: '/uploads',
          },
        ];
      },
    }),
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
    MyVideosModule,
    AiModule,
    TasksModule,
    WebsocketModule,
  ],
})
export class AppModule {}
