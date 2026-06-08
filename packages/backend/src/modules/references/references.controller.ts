import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReferencesService } from './references.service';
import { CreateReferenceDto, UploadReferenceDto } from './dto/references.dto';

@ApiTags('参考视频 /references')
@Controller('references')
export class ReferencesController {
  constructor(private readonly referencesService: ReferencesService) {}

  @Post()
  @ApiOperation({ summary: '2.1 添加参考视频 (基于 URL)' })
  create(@Body() dto: CreateReferenceDto) {
    return this.referencesService.create(dto);
  }

  @Post('upload')
  @ApiOperation({ summary: '添加参考视频 (基于本地上传)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadReferenceDto) {
    return this.referencesService.upload(file, dto);
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
