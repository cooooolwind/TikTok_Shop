import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { EmbeddingService } from './embedding.service';
import { Material } from './entities/material.entity';
import { VideoSlice } from './entities/video-slice.entity';
import { WebsocketModule } from '../../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, VideoSlice]),
    WebsocketModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const storage = config.get('storage') as { localPath: string };
            const tempDir = join(storage.localPath, 'temp');
            if (!existsSync(tempDir)) {
              mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
          },
          filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${uniqueSuffix}-${file.originalname}`);
          },
        }),
        limits: {
          fileSize: 500 * 1024 * 1024, // 500MB
        },
      }),
    }),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService, EmbeddingService],
  exports: [MaterialsService, EmbeddingService],
})
export class MaterialsModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const storage = this.configService.get('storage') as { localPath: string };
    const dirs = [
      join(storage.localPath, 'temp'),
      join(storage.localPath, 'materials'),
      join(storage.localPath, 'materials', 'thumbnails'),
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
}
