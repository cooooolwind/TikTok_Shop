import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BatchDeleteDto } from '../../common/dto/batch-delete.dto';
import { MaterialListQueryDto } from './dto/material-list-query.dto';
import { SimilarSearchDto } from './dto/similar-search.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialsService } from './materials.service';

@ApiTags('素材管理 /materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('upload')
  @ApiOperation({ summary: '上传素材' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @Body() body: UploadMaterialDto) {
    return this.materialsService.upload(file, body);
  }

  @Get()
  @ApiOperation({ summary: '素材列表' })
  findAll(@Query() query: MaterialListQueryDto) {
    return this.materialsService.findAll(query);
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除素材' })
  batchRemove(@Body() body: BatchDeleteDto) {
    return this.materialsService.batchRemove(body.ids);
  }

  @Post('search/similar')
  @ApiOperation({ summary: '相似素材搜索' })
  searchSimilar(@Body() body: SimilarSearchDto) {
    return this.materialsService.searchSimilar(body);
  }

  @Post('search/backfill')
  @ApiOperation({ summary: '回填向量嵌入（批量）' })
  backfillEmbeddings(@Body() body: { materialIds?: string[] }) {
    return this.materialsService.backfillEmbeddings(body.materialIds);
  }

  @Get(':id')
  @ApiOperation({ summary: '素材详情' })
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新素材信息' })
  update(@Param('id') id: string, @Body() body: UpdateMaterialDto) {
    return this.materialsService.update(id, body);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: '触发 AI 打标' })
  analyze(@Param('id') id: string) {
    return this.materialsService.analyze(id);
  }

  @Get(':id/slices')
  @ApiOperation({ summary: '视频切片列表' })
  findSlices(@Param('id') id: string) {
    return this.materialsService.findSlices(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除素材' })
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }
}
