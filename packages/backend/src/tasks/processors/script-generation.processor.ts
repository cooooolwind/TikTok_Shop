import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import type { ProductInfo, ScriptMode, ScriptPreferences } from '@aigc/shared-types';
import { VolcanoClientProvider } from '../../ai/providers/volcano-client.provider';
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
      const aiResponse = await this.volcanoClient.chatCompletion(this.buildMessages(job.data), {
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

  private buildMessages(data: ScriptGenerationJob) {
    return [
      {
        role: 'system',
        content:
          [
            '你是一位专注于转化的抖音小店电商短视频导演和带货文案师。',
            '你唯一的目标是生成带货剧本，让观看者明白为什么要现在购买这款产品。',
            '返回严格的 JSON，包含 narrative_framework、visual_style、total_duration 和 scenes[]。',
            '整个剧本时长不得超过12秒。',
            '这不是普通生活类视频：每个分镜必须直接服务于电商带货、产品卖点、购物意图和转化。',
            '剧本结构要求：开头用痛点、反差、利益点或使用场景打造强力3秒钩子；每个分镜至少包含一个具体卖点或产品价值；最后一个分镜以明确CTA收尾，如点击、立即下单、领券、查看商品详情。',
            '每个分镜需要包含 description、camera_motion、duration、dialogue、bgm_style、subtitle、visual_prompt、constraints。',
            '字段规则：description 必须写明卖货目的和可见动作；dialogue 必须像达人或主播带货口吻；subtitle 必须简短且促转化；visual_prompt 必须描述电商素材，如商品特写、上身效果、细节展示、对比展示、包装展示、价格/优惠提示、购物场景等；constraints 必须要求产品可见、可识别、切题、商业安全、不得是无关联剧情。',
            '在对话或字幕中使用产品名。将产品 selling_points 分配到各分镜。根据 target_audience 调整用词和场景。如有价格或优惠信息，用作利益点或CTA提示，不得虚构折扣。',
            '不要生成抽象意境镜头、泛化叙事、无关剧情或没有产品展示的分镜。',
            '如果提供 material_context，必须优先参考素材 AI 分析、ai_tags、ai_description 和视频切片来设计分镜。',
            '视频切片中的起止时间、描述和标签代表可用素材内容；不要凭空生成与素材分析矛盾或素材中不存在的关键画面。',
          ].join(' '),
      },
      {
        role: 'user',
        content: this.buildUserContent(
          {
            commerce_objective:
              '生成抖音小店带货转化剧本。剧本必须让观看者明白为什么要现在购买这款产品。',
            product_info: data.productInfo,
            mode: data.mode,
            preferences: data.preferences,
            template: data.template,
            material_context: data.materialContext,
            material_media: (data.materialMedia ?? []).map((item) => ({
              type: item.type,
              filename: item.filename,
              url: item.url,
              thumbnail_url: item.thumbnailUrl,
            })),
            manual_text: data.manualText,
          },
          data.materialMedia ?? [],
        ),
      },
    ];
  }

  private buildUserContent(payload: Record<string, unknown>, materialMedia: NonNullable<ScriptGenerationJob['materialMedia']>) {
    const imageItems = materialMedia
      .filter((item) => item.type === 'image' && item.imageUrl)
      .map((item) => ({
        type: 'image_url',
        image_url: { url: item.imageUrl as string },
      }));

    if (imageItems.length === 0) return JSON.stringify(payload);

    return [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
      ...imageItems,
    ];
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
