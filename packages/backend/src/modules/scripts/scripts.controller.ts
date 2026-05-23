import { Body, Controller, Get, Post, Put, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScriptsService } from './scripts.service';
import { CreateScriptDto, GenerateScriptDto, ScriptListQueryDto } from './dto/script.dto';
import type {
  AddSceneRequest,
  RegenerateSceneRequest,
  ReorderScenesRequest,
  ScriptListQuery,
  UpdateSceneRequest,
  UpdateScriptRequest,
} from '@aigc/shared-types';

@ApiTags('剧本 /scripts')
@Controller('scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Post('generate')
  @ApiOperation({ summary: '3.1 生成剧本' })
  generate(@Body() body: GenerateScriptDto) {
    return this.scriptsService.generate(body);
  }

  @Post()
  @ApiOperation({ summary: '创建手写剧本草稿' })
  create(@Body() body: CreateScriptDto) {
    return this.scriptsService.create(body as never);
  }

  @Post('generate/batch')
  @ApiOperation({ summary: '3.2 批量生成剧本' })
  batchGenerate() {
    return this.scriptsService.batchGenerate();
  }

  @Get()
  @ApiOperation({ summary: '3.3 剧本列表' })
  findAll(@Query() query: ScriptListQueryDto) {
    return this.scriptsService.findAll(query as ScriptListQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: '3.4 剧本详情' })
  findOne(@Param('id') id: string) {
    return this.scriptsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '3.5 更新剧本（整体）' })
  update(@Param('id') id: string, @Body() body: UpdateScriptRequest) {
    return this.scriptsService.update(id, body);
  }

  @Put(':id/scenes/:sceneId')
  @ApiOperation({ summary: '3.6 更新单个分镜' })
  updateScene(@Param('id') id: string, @Param('sceneId') sceneId: string, @Body() body: UpdateSceneRequest) {
    return this.scriptsService.updateScene(id, sceneId, body);
  }

  @Post(':id/scenes')
  @ApiOperation({ summary: '3.7 添加分镜' })
  addScene(@Param('id') id: string, @Body() body: AddSceneRequest) {
    return this.scriptsService.addScene(id, body);
  }

  @Delete(':id/scenes/:sceneId')
  @ApiOperation({ summary: '3.8 删除分镜' })
  removeScene(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.scriptsService.removeScene(id, sceneId);
  }

  @Put(':id/scenes/reorder')
  @ApiOperation({ summary: '3.9 分镜排序' })
  reorderScenes(@Param('id') id: string, @Body() body: ReorderScenesRequest) {
    return this.scriptsService.reorderScenes(id, body);
  }

  @Post(':id/scenes/:sceneId/regenerate')
  @ApiOperation({ summary: '3.10 重新生成分镜台词' })
  regenerateScene(@Param('id') id: string, @Param('sceneId') sceneId: string, @Body() _body: RegenerateSceneRequest) {
    return this.scriptsService.regenerateScene(id, sceneId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '重新生成失败剧本' })
  retry(@Param('id') id: string) {
    return this.scriptsService.retry(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: '3.11 确认剧本' })
  confirm(@Param('id') id: string) {
    return this.scriptsService.confirm(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '3.12 删除剧本' })
  remove(@Param('id') id: string) {
    return this.scriptsService.remove(id);
  }
}
