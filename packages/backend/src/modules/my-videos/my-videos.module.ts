import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyVideoEntity } from './entities/my-video.entity';
import { MyVideosController } from './my-videos.controller';
import { MyVideosService } from './my-videos.service';

@Module({
  imports: [TypeOrmModule.forFeature([MyVideoEntity])],
  controllers: [MyVideosController],
  providers: [MyVideosService],
})
export class MyVideosModule {}
