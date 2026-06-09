import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import type { ProductInfo, ScriptBlueprint, ScriptMode, ScriptPreferences } from '@aigc/shared-types';
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
  script_blueprint?: ScriptBlueprint | null;
  narrative_framework?: string;
  visual_style?: string;
  total_duration?: number;
  scenes?: AiScene[];
}

const MIN_SCRIPT_DURATION = 4;
const MAX_SCRIPT_DURATION = 30;
const MIN_SCENE_DURATION = 4;
const MAX_SCENE_DURATION = 12;

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
      await this.persistResult(script, this.applyDialoguePreferences(parsed, job.data.preferences), job.data.preferences);

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
      if ((!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) && !this.hasBlueprintScenes(parsed.script_blueprint)) {
        throw new Error('AI 返回结果不包含分镜数据');
      }
      return parsed;
    } catch (error) {
      throw new Error(error instanceof SyntaxError ? 'AI 返回结果不是合法 JSON' : (error as Error).message);
    }
  }

  private async persistResult(script: Script, result: AiScriptResult, preferences?: ScriptPreferences) {
    await this.scenesRepository.delete({ scriptId: script.id });
    const scenes = this.normalizeScenes(
      result.scenes && result.scenes.length > 0
        ? result.scenes
        : this.mapBlueprintScenesToAiScenes(result.script_blueprint),
      preferences,
    );
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
      scene.subtitle || scene.dialogue || '',
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
           script_blueprint = $4,
           status = 'draft',
           generation_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        result.narrative_framework ?? script.narrativeFramework ?? '',
        result.visual_style ?? script.visualStyle ?? '',
        this.resolveTotalDuration(scenes),
        result.script_blueprint ?? null,
        script.id,
      ],
    );
  }

  private normalizeScenes(scenes: AiScene[], preferences?: ScriptPreferences) {
    if (scenes.length === 0) return [];
    let remaining = this.resolveScriptTargetDuration(preferences);
    const normalized: AiScene[] = [];

    for (const scene of scenes) {
      if (remaining < MIN_SCENE_DURATION) break;
      const requestedDuration = Math.round(Number(scene.duration) || MIN_SCENE_DURATION);
      const duration = Math.min(
        Math.max(requestedDuration, MIN_SCENE_DURATION),
        MAX_SCENE_DURATION,
        remaining,
      );
      normalized.push({ ...scene, duration });
      remaining -= duration;
    }

    return normalized.length > 0 ? normalized : [{ description: '商品展示', duration: MIN_SCRIPT_DURATION }];
  }

  private resolveScriptTargetDuration(preferences?: ScriptPreferences) {
    const requested = Math.round(Number(preferences?.duration) || MAX_SCRIPT_DURATION);
    return Math.min(Math.max(requested, MIN_SCRIPT_DURATION), MAX_SCRIPT_DURATION);
  }

  private hasBlueprintScenes(blueprint: ScriptBlueprint | null | undefined) {
    return Array.isArray(blueprint?.scenes) && blueprint.scenes.length > 0;
  }

  private mapBlueprintScenesToAiScenes(blueprint: ScriptBlueprint | null | undefined): AiScene[] {
    if (!this.hasBlueprintScenes(blueprint)) return [];
    return (blueprint?.scenes ?? []).map((scene) => ({
      description: scene.visual_content || [scene.shot_size, scene.composition, scene.camera_movement].filter(Boolean).join('，'),
      camera_motion: scene.camera_movement || 'fixed',
      duration: this.durationFromTimeRange(scene.time_range),
      dialogue: scene.dialogue ?? '',
      bgm_style: blueprint?.audio || scene.audio || '同期声',
      subtitle: scene.subtitle || scene.dialogue || '',
      visual_prompt: this.buildVisualPromptFromBlueprint(blueprint, scene),
      constraints: ['保持基础设定、主体身份、场景风格和声音规则一致'],
    }));
  }

  private buildVisualPromptFromBlueprint(blueprint: ScriptBlueprint | null | undefined, scene: NonNullable<ScriptBlueprint['scenes']>[number]) {
    return [
      `基础设定：${blueprint?.basic_setting ?? ''}`,
      `氛围与画质：${blueprint?.atmosphere_and_quality ?? ''}`,
      `声音规则：${blueprint?.audio ?? ''}`,
      `时间段：${scene.time_range}`,
      `景别：${scene.shot_size}`,
      `构图：${scene.composition}`,
      `运镜：${scene.camera_movement}`,
      `画面内容：${scene.visual_content}`,
      scene.audio ? `当前分镜声音：${scene.audio}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private durationFromTimeRange(timeRange: string) {
    const match = timeRange.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return 4;
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    return Math.max(MIN_SCENE_DURATION, end - start);
  }

  private resolveTotalDuration(scenes: AiScene[]) {
    const sceneTotal = scenes.reduce((sum, scene) => sum + (scene.duration ?? 3), 0);
    return Math.min(Math.max(sceneTotal, MIN_SCRIPT_DURATION), MAX_SCRIPT_DURATION);
  }

  private applyDialoguePreferences(result: AiScriptResult, preferences?: ScriptPreferences): AiScriptResult {
    if (this.isDialogueDisabled(preferences)) {
      return {
        ...result,
        script_blueprint: result.script_blueprint
          ? {
              ...result.script_blueprint,
              audio: this.sanitizeAudioForNoDialogue(result.script_blueprint.audio, true),
              scenes: (result.script_blueprint.scenes ?? []).map((scene) => ({
                ...scene,
                audio: this.sanitizeAudioForNoDialogue(scene.audio),
                dialogue: '',
                subtitle: '',
              })),
            }
          : result.script_blueprint,
        scenes: result.scenes?.map((scene) => ({
          ...scene,
          dialogue: '',
          bgm_style: this.sanitizeAudioForNoDialogue(scene.bgm_style),
          subtitle: '',
        })),
      };
    }

    return {
      ...result,
      script_blueprint: result.script_blueprint
        ? {
            ...result.script_blueprint,
            scenes: (result.script_blueprint.scenes ?? []).map((scene) =>
              scene.dialogue ? { ...scene, subtitle: scene.subtitle || scene.dialogue } : scene,
            ),
          }
        : result.script_blueprint,
      scenes: result.scenes?.map((scene) => ({
        ...scene,
        subtitle: scene.dialogue ? scene.subtitle || scene.dialogue : scene.subtitle,
      })),
    };
  }

  private isDialogueDisabled(preferences?: ScriptPreferences) {
    const maybePreferences = preferences as (ScriptPreferences & { dialogueMode?: string }) | undefined;
    return maybePreferences?.dialogue_mode === 'disabled' || maybePreferences?.dialogueMode === 'disabled';
  }

  private sanitizeAudioForNoDialogue(audio: string | undefined, global = false) {
    const fallback = global ? '仅保留同期声和环境声，不包含口播、旁白或对白' : '仅保留同期声和环境声';
    if (!audio?.trim()) return fallback;
    return /台词|口播|旁白|对白|字幕|解说|配音|说[:：]|说话|朗读|TTS/i.test(audio) ? fallback : audio;
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
