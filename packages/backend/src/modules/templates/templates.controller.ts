import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GenerateTemplateDto, TemplateListQueryDto, UpsertTemplateDto } from './dto/template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('灵感模板 /templates')
@Controller(['templates', 'inspiration-templates'])
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: '创建灵感模板' })
  create(@Body() body: UpsertTemplateDto) {
    return this.templatesService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '模板列表' })
  findAll(@Query() query: TemplateListQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '模板详情' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post(':id/generate')
  @ApiOperation({ summary: '使用模板生成带货视频方案' })
  generate(@Param('id') id: string, @Body() body: GenerateTemplateDto) {
    return this.templatesService.generate(id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新模板' })
  update(@Param('id') id: string, @Body() body: Partial<UpsertTemplateDto>) {
    return this.templatesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除模板' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
