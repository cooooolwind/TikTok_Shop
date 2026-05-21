import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GenerationService } from './generation.service';

@ApiTags('视频创作 /generation')
@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('create')
  @ApiOperation({ summary: '4.1 一键成片' })
  create() {
    return this.generationService.create();
  }

  @Post('quick')
  @ApiOperation({ summary: '4.2 快速成片（跳过剧本步骤）' })
  quickCreate() {
    return this.generationService.quickCreate();
  }

  @Get('tasks')
  @ApiOperation({ summary: '4.3 任务列表' })
  findTasks() {
    return this.generationService.findTasks();
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

  @Post('tasks/:taskId/scenes/:sceneId/regenerate')
  @ApiOperation({ summary: '4.7 单分镜重新生成' })
  regenerateScene(@Param('taskId') taskId: string, @Param('sceneId') sceneId: string) {
    return this.generationService.regenerateScene(taskId, sceneId);
  }

  @Post('tasks/:taskId/export')
  @ApiOperation({ summary: '4.8 视频导出' })
  export(@Param('taskId') taskId: string) {
    return this.generationService.export(taskId);
  }
}
