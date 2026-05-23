import { Body, Controller, Get, Post, Put, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { TemplateListQueryDto, UpsertTemplateDto } from './dto/template.dto';

@ApiTags('灵感模板 /templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: '2.5 创建灵感模板' })
  create(@Body() body: UpsertTemplateDto) {
    return this.templatesService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '2.6 模板列表' })
  findAll(@Query() query: TemplateListQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '2.7 模板详情' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '2.8 更新模板' })
  update(@Param('id') id: string, @Body() body: Partial<UpsertTemplateDto>) {
    return this.templatesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '2.9 删除模板' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
