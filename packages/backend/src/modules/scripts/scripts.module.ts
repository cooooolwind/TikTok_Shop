import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';
import { Script } from './entities/script.entity';
import { Scene } from './entities/scene.entity';
import { Material } from '../materials/entities/material.entity';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [TypeOrmModule.forFeature([Script, Scene, Material]), TemplatesModule],
  controllers: [ScriptsController],
  providers: [ScriptsService],
  exports: [ScriptsService],
})
export class ScriptsModule {}
