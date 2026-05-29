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
      await this.updateProgress(job, 1, 4, 'prepare', '姝ｅ湪鏁寸悊鍓ф湰鐢熸垚涓婁笅鏂?..');
      const script = await this.scriptsRepository.findOne({ where: { id: scriptId }, relations: { scenes: true } });
      if (!script) throw new Error(`Script ${scriptId} not found`);

      await this.updateProgress(job, 2, 4, 'ai_generate', '姝ｅ湪璋冪敤 AI 鐢熸垚鍓ф湰...');
      const aiResponse = await this.volcanoClient.chatCompletion(this.buildMessages(job.data), {
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      const parsed = this.parseAiResponse(aiResponse.content);

      await this.updateProgress(job, 3, 4, 'persist', '姝ｅ湪淇濆瓨鍒嗛暅...');
      await this.persistResult(script, parsed);

      await this.updateProgress(job, 4, 4, 'done', '鍓ф湰鐢熸垚瀹屾垚');
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
            'You are a conversion-focused TikTok Shop ecommerce short-video director and sales copywriter.',
            'Your only goal is to generate product-selling scripts that make viewers understand why to buy this product now.',
            'Return strict JSON with narrative_framework, visual_style, total_duration, and scenes[].',
            'The whole script must be no longer than 12 seconds.',
            'This is not a generic lifestyle video: every scene must be directly related to ecommerce selling, product benefits, shopping intent, and conversion.',
            'Required script structure: open with a strong 3-second hook using a pain point, contrast, benefit, or usage scenario; assign at least one concrete selling point or product value to every scene; end the final scene with a clear CTA such as click, order now, claim the offer, or view product details.',
            'Each scene needs description, camera_motion, duration, dialogue, bgm_style, subtitle, visual_prompt, constraints.',
            'Field rules: description must state the selling purpose and visible action; dialogue must sound like a creator or livestream host selling the product; subtitle must be short and conversion-oriented; visual_prompt must describe ecommerce footage such as product close-up, try-on or usage result, detail demonstration, before-after comparison, package, price/offer cue, or shopping scenario; constraints must require the product visible, recognizable, on-topic, commercially safe, and not an unrelated story.',
            'Use the product name in dialogue or subtitle. Distribute product selling_points across scenes. Use target_audience to shape wording and scenario. If price or offer information exists, use it as a benefit or CTA cue without inventing false discounts.',
            'Do not produce abstract mood shots, generic storytelling, unrelated drama, or scenes without product display.',
          ].join(' '),
      },
      {
        role: 'user',
        content: this.buildUserContent(
          {
            commerce_objective:
              'Generate a TikTok Shop conversion-focused product selling script. The script must make viewers understand why to buy this product now.',
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
        throw new Error('AI response does not contain scenes');
      }
      return parsed;
    } catch (error) {
      throw new Error(error instanceof SyntaxError ? 'AI response is not valid JSON' : (error as Error).message);
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

    return normalized.length > 0 ? normalized : [{ description: 'Product demo', duration: 5 }];
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
