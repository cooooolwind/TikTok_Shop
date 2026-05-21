import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferencesController } from './references.controller';
import { ReferencesService } from './references.service';
import { ReferenceVideo } from './entities/reference-video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceVideo])],
  controllers: [ReferencesController],
  providers: [ReferencesService],
  exports: [ReferencesService],
})
export class ReferencesModule {}
