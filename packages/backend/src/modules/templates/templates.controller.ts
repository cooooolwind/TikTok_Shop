import { Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';

@ApiTags('灵感模板 /templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: '2.5 创建灵感模板' })
  create() {
    return this.templatesService.create();
  }

  @Get()
  @ApiOperation({ summary: '2.6 模板列表' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '2.7 模板详情' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '2.8 更新模板' })
  update(@Param('id') id: string) {
    return this.templatesService.update(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '2.9 删除模板' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
