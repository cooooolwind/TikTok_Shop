import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';
import { Script } from './entities/script.entity';
import { Scene } from './entities/scene.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Script, Scene])],
  controllers: [ScriptsController],
  providers: [ScriptsService],
  exports: [ScriptsService],
})
export class ScriptsModule {}
