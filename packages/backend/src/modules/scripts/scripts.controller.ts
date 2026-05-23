import { Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScriptsService } from './scripts.service';

@ApiTags('剧本 /scripts')
@Controller('scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Post('generate')
  @ApiOperation({ summary: '3.1 生成剧本' })
  generate() {
    return this.scriptsService.generate();
  }

  @Post('generate/batch')
  @ApiOperation({ summary: '3.2 批量生成剧本' })
  batchGenerate() {
    return this.scriptsService.batchGenerate();
  }

  @Get()
  @ApiOperation({ summary: '3.3 剧本列表' })
  findAll() {
    return this.scriptsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '3.4 剧本详情' })
  findOne(@Param('id') id: string) {
    return this.scriptsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '3.5 更新剧本（整体）' })
  update(@Param('id') id: string) {
    return this.scriptsService.update(id);
  }

  @Put(':id/scenes/:sceneId')
  @ApiOperation({ summary: '3.6 更新单个分镜' })
  updateScene(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.scriptsService.updateScene(id, sceneId);
  }

  @Post(':id/scenes')
  @ApiOperation({ summary: '3.7 添加分镜' })
  addScene(@Param('id') id: string) {
    return this.scriptsService.addScene(id);
  }

  @Delete(':id/scenes/:sceneId')
  @ApiOperation({ summary: '3.8 删除分镜' })
  removeScene(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.scriptsService.removeScene(id, sceneId);
  }

  @Put(':id/scenes/reorder')
  @ApiOperation({ summary: '3.9 分镜排序' })
  reorderScenes(@Param('id') id: string) {
    return this.scriptsService.reorderScenes(id);
  }

  @Post(':id/scenes/:sceneId/regenerate')
  @ApiOperation({ summary: '3.10 重新生成分镜台词' })
  regenerateScene(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.scriptsService.regenerateScene(id, sceneId);
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
