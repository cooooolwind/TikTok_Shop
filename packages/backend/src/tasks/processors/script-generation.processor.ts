import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import type { ProductInfo, ScriptMode, ScriptPreferences } from '@aigc/shared-types';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
import { buildScriptGenerationMessages } from '../../ai/prompts';
import { Script } from '../../modules/scripts/entities/script.entity';
import { Scene } from '../../modules/scripts/entities/scene.entity';
import { TasksGateway } from '../../websocket/tasks.gateway';
import { QUEUES } from '../queues';

interface ScriptGenerationJob {
  taskId: string;
  scriptId: string;
  productInfo: ProductInfo;
  mode: ScriptMode;
  preferences?: ScriptPreferences;
  template?: unknown;
  reference?: unknown;
  materialContext?: string;
  materialMedia?: { type: 'image' | 'video'; filename: string; imageUrl?: string; url?: string; thumbnailUrl?: string }[];
  manualText?: string;
}

interface AiScene {
  description?: string;
  camera_motion?: string;
  duration?: number;
  dialogue?: string;
  bgm_style?: string;
  subtitle?: string;
  visual_prompt?: string;
  constraints?: string[];
}

interface AiScriptResult {
  narrative_framework?: string;
  visual_style?: string;
  total_duration?: number;
  scenes?: AiScene[];
}

@Processor(QUEUES.SCRIPT_GENERATION)
export class ScriptGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ScriptGenerationProcessor.name);

  constructor(
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Scene) private readonly scenesRepository: Repository<Scene>,
    private readonly volcanoClient: VolcanoClientProvider,
    private readonly tasksGateway: TasksGateway,
  ) {
    super();
  }

  async process(job: Job<ScriptGenerationJob>): Promise<{ script_id: string; status: 'draft' }> {
    const { taskId, scriptId } = job.data;
    try {
      await this.updateProgress(job, 1, 4, 'prepare', '正在整理剧本生成上下文...');
      const script = await this.scriptsRepository.findOne({ where: { id: scriptId }, relations: { scenes: true } });
      if (!script) throw new Error(`Script ${scriptId} not found`);

      await this.updateProgress(job, 2, 4, 'ai_generate', '正在调用 AI 生成剧本...');
      const aiResponse = await this.volcanoClient.chatCompletion(buildScriptGenerationMessages(job.data), {
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      const parsed = this.parseAiResponse(aiResponse.content);

      await this.updateProgress(job, 3, 4, 'persist', '正在保存分镜...');
      await this.persistResult(script, parsed);

      await this.updateProgress(job, 4, 4, 'done', '剧本生成完成');
      this.tasksGateway.emitScriptGenerated(script.id);
      return { script_id: script.id, status: 'draft' };
    } catch (error) {
      await this.markFailed(scriptId, taskId, error);
      throw error;
    }
  }


  private parseAiResponse(content: string): AiScriptResult {
    try {
      const parsed = JSON.parse(content) as AiScriptResult;
      if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
        throw new Error('AI 返回结果不包含分镜数据');
      }
      return parsed;
    } catch (error) {
      throw new Error(error instanceof SyntaxError ? 'AI 返回结果不是合法 JSON' : (error as Error).message);
    }
  }

  private async persistResult(script: Script, result: AiScriptResult) {
    await this.scenesRepository.delete({ scriptId: script.id });
    const scenes = this.normalizeScenes(result.scenes ?? []);
    const columnsPerScene = 9;
    const valuesSql = scenes
      .map((_, sceneIndex) => {
        const offset = sceneIndex * columnsPerScene;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
      })
      .join(', ');
    const params = scenes.flatMap((scene, index) => [
      script.id,
      index + 1,
      scene.description ?? '',
      scene.camera_motion ?? 'fixed',
      scene.duration ?? 3,
      scene.dialogue ?? '',
      scene.bgm_style ?? 'upbeat',
      scene.subtitle ?? scene.dialogue ?? '',
      scene.visual_prompt ?? scene.description ?? '',
    ]);

    await this.scenesRepository.query(
      `INSERT INTO scenes (
        script_id,
        order_num,
        description,
        camera_motion,
        duration,
        dialogue,
        bgm_style,
        subtitle,
        visual_prompt
      ) VALUES ${valuesSql}`,
      params,
    );

    await this.scriptsRepository.query(
      `UPDATE scripts
       SET narrative_framework = $1,
           visual_style = $2,
           total_duration = $3,
           status = 'draft',
           generation_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        result.narrative_framework ?? script.narrativeFramework ?? '',
        result.visual_style ?? script.visualStyle ?? '',
        Math.min(result.total_duration ?? scenes.reduce((sum, scene) => sum + (scene.duration ?? 3), 0), 12),
        script.id,
      ],
    );
  }

  private normalizeScenes(scenes: AiScene[]) {
    let remaining = 12;
    const normalized: AiScene[] = [];

    for (const scene of scenes) {
      if (remaining <= 0) break;
      const duration = Math.min(Math.max(Math.round(Number(scene.duration) || 3), 1), remaining);
      normalized.push({ ...scene, duration });
      remaining -= duration;
    }

    return normalized.length > 0 ? normalized : [{ description: '商品展示', duration: 5 }];
  }

  private async markFailed(scriptId: string, taskId: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Script generation failed';
    const script = await this.scriptsRepository.findOne({ where: { id: scriptId } });
    if (script) {
      script.status = 'failed';
      script.generationError = message;
      await this.scriptsRepository.save(script);
    }
    this.tasksGateway.emitTaskFailed(taskId, {
      code: 'SCRIPT_GENERATION_FAILED',
      message,
      retryable: true,
    });
  }

  private async updateProgress(
    job: Job<ScriptGenerationJob>,
    currentStep: number,
    totalSteps: number,
    stepName: string,
    message: string,
  ) {
    const progress = {
      current_step: currentStep,
      total_steps: totalSteps,
      step_name: stepName,
      percentage: Math.round((currentStep / totalSteps) * 100),
      message,
      estimated_remaining: (totalSteps - currentStep) * 5,
    };
    await job.updateProgress(progress);
    this.tasksGateway.emitTaskProgress(job.data.taskId, progress);
    this.logger.log(`[${currentStep}/${totalSteps}] ${message}`);
  }
}
