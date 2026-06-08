import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';
import { Script } from './entities/script.entity';
import { Scene } from './entities/scene.entity';
import { Material } from '../materials/entities/material.entity';
import { TemplatesModule } from '../templates/templates.module';
import { ReferencesModule } from '../references/references.module';
import { GenerationTask } from '../generation/entities/generation-task.entity';
import { Video } from '../generation/entities/video.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Script, Scene, Material, GenerationTask, Video]),
    TemplatesModule,
    ReferencesModule,
  ],
  controllers: [ScriptsController],
  providers: [ScriptsService],
  exports: [ScriptsService],
})
export class ScriptsModule {}
