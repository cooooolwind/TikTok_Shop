import { Body, Controller, Delete, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type {
  CreateVideoRequest,
  ExportRequest,
  GenerationListQuery,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
} from '@aigc/shared-types';
import { GenerationService } from './generation.service';

@ApiTags('视频创作 /generation')
@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('create')
  @ApiOperation({ summary: '4.1 一键成片' })
  create(@Body() data: CreateVideoRequest) {
    return this.generationService.create(data);
  }

  @Post('quick')
  @ApiOperation({ summary: '4.2 快速成片（跳过剧本步骤）' })
  quickCreate(@Body() data: QuickGenerateRequest) {
    return this.generationService.quickCreate(data);
  }

  @Get('tasks')
  @ApiOperation({ summary: '4.3 任务列表' })
  findTasks(@Query() query: GenerationListQuery) {
    return this.generationService.findTasks(query);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: '4.4 任务详情' })
  findTask(@Param('taskId') taskId: string) {
    return this.generationService.findTask(taskId);
  }

  @Post('tasks/:taskId/retry')
  @ApiOperation({ summary: '4.5 重试失败任务' })
  retry(@Param('taskId') taskId: string) {
    return this.generationService.retry(taskId);
  }

  @Post('tasks/:taskId/cancel')
  @ApiOperation({ summary: '4.6 取消任务' })
  cancel(@Param('taskId') taskId: string) {
    return this.generationService.cancel(taskId);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: '4.7 删除创作任务' })
  remove(@Param('taskId') taskId: string) {
    return this.generationService.remove(taskId);
  }

  @Post('tasks/:taskId/scenes/:sceneId/regenerate')
  @ApiOperation({ summary: '4.7 单分镜重新生成' })
  regenerateScene(
    @Param('taskId') taskId: string,
    @Param('sceneId') sceneId: string,
    @Body() data: RegenerateSceneVideoRequest,
  ) {
    return this.generationService.regenerateScene(taskId, sceneId, data);
  }

  @Post('tasks/:taskId/export')
  @ApiOperation({ summary: '4.8 视频导出' })
  export(@Param('taskId') taskId: string, @Body() _data: ExportRequest) {
    return this.generationService.export(taskId);
  }
}
