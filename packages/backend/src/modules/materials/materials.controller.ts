import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';

@ApiTags('素材管理 /materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('upload')
  @ApiOperation({ summary: '1.1 上传素材' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload() {
    return this.materialsService.upload();
  }

  @Get()
  @ApiOperation({ summary: '1.2 素材列表' })
  findAll() {
    return this.materialsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '1.3 素材详情' })
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '1.4 删除素材' })
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }

  @Delete('batch')
  @ApiOperation({ summary: '1.5 批量删除素材' })
  batchRemove() {
    return this.materialsService.batchRemove();
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: '1.6 触发 AI 打标' })
  analyze(@Param('id') id: string) {
    return this.materialsService.analyze(id);
  }

  @Get(':id/slices')
  @ApiOperation({ summary: '1.7 视频切片列表' })
  findSlices(@Param('id') id: string) {
    return this.materialsService.findSlices(id);
  }

  @Post('search/similar')
  @ApiOperation({ summary: '1.8 向量相似搜索' })
  searchSimilar() {
    return this.materialsService.searchSimilar();
  }
}
