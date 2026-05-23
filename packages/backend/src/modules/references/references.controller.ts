import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReferencesService } from './references.service';

@ApiTags('参考视频 /references')
@Controller('references')
export class ReferencesController {
  constructor(private readonly referencesService: ReferencesService) {}

  @Post()
  @ApiOperation({ summary: '2.1 添加参考视频' })
  create() {
    return this.referencesService.create();
  }

  @Get()
  @ApiOperation({ summary: '2.2 参考视频列表' })
  findAll() {
    return this.referencesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '2.3 参考视频详情' })
  findOne(@Param('id') id: string) {
    return this.referencesService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '2.4 删除参考视频' })
  remove(@Param('id') id: string) {
    return this.referencesService.remove(id);
  }
}
