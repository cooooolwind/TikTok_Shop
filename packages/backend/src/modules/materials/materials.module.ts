import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { Material } from './entities/material.entity';
import { VideoSlice } from './entities/video-slice.entity';
import { WebsocketModule } from '../../websocket/websocket.module';

@Module({
  imports: [TypeOrmModule.forFeature([Material, VideoSlice]), WebsocketModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
