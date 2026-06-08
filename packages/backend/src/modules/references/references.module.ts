import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { BullModule } from '@nestjs/bullmq';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ReferencesController } from './references.controller';
import { ReferencesService } from './references.service';
import { ReferenceVideo } from './entities/reference-video.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferenceVideo]),
    BullModule.registerQueue({ name: 'reference-analysis' }),
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
  controllers: [ReferencesController],
  providers: [ReferencesService],
  exports: [ReferencesService],
})
export class ReferencesModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const storage = this.configService.get('storage') as { localPath: string };
    const uploadDir = join(storage.localPath, 'references');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
  }
}
