import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SaveMyVideoDto } from './dto/my-video.dto';
import { MyVideosService } from './my-videos.service';

@ApiTags('我的作品 /my-videos')
@Controller('my-videos')
export class MyVideosController {
  constructor(private readonly myVideosService: MyVideosService) {}

  @Post()
  @ApiOperation({ summary: '保存生成的带货视频方案' })
  create(@Body() body: SaveMyVideoDto) {
    return this.myVideosService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '我的作品列表' })
  findAll() {
    return this.myVideosService.findAll();
  }
}
