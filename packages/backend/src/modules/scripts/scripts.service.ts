import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import type {
  AddSceneRequest,
  CreateScriptRequest,
  GenerateScriptQueuedResponse,
  GenerateScriptRequest,
  ReorderScenesRequest,
  Scene as SceneResponse,
  Script as ScriptResponse,
  ScriptListQuery,
  UpdateSceneRequest,
  UpdateScriptRequest,
} from '@aigc/shared-types';
import { QUEUES } from '../../tasks/queues';
import { Material } from '../materials/entities/material.entity';
import { TemplatesService } from '../templates/templates.service';
import { Scene } from './entities/scene.entity';
import { Script } from './entities/script.entity';

const DEFAULT_MERCHANT_ID = 'default';

@Injectable()
export class ScriptsService {
  constructor(
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Scene) private readonly scenesRepository: Repository<Scene>,
    @InjectRepository(Material) private readonly materialsRepository: Repository<Material>,
    private readonly templatesService: TemplatesService,
    @InjectQueue(QUEUES.SCRIPT_GENERATION) private readonly scriptQueue: Queue,
  ) {}

  async generate(data: GenerateScriptRequest): Promise<GenerateScriptQueuedResponse> {
    const materialContext = await this.buildMaterialContext(data.material_ids ?? []);
    const template = data.template_id ? await this.templatesService.findRawById(data.template_id) : null;
    if (data.template_id && !template) throw new NotFoundException('Template not found');

    const taskId = `script_generation_${randomUUID()}`;
    const script = await this.scriptsRepository.save(
      this.scriptsRepository.create({
        merchantId: DEFAULT_MERCHANT_ID,
        productInfo: data.product_info,
        templateId: data.template_id ?? null,
        referenceId: data.reference_id ?? null,
        sourceMaterialIds: data.material_ids ?? [],
        generationTaskId: taskId,
        generationError: null,
        mode: data.mode,
        narrativeFramework: template?.strategy ?? '',
        visualStyle: data.preferences?.style ?? '',
        totalDuration: data.preferences?.duration ?? 15,
        status: 'generating',
        scenes: [],
      }),
    );

    const stableTaskId = `script_generation_${script.id}`;
    script.generationTaskId = stableTaskId;
    const saved = await this.scriptsRepository.save(script);

    await this.scriptQueue.add(
      'generate',
      {
        taskId: stableTaskId,
        scriptId: saved.id,
        productInfo: data.product_info,
        mode: data.mode,
        preferences: data.preferences,
        template,
        materialContext,
        manualText: data.manual_text,
      },
      { attempts: 2, removeOnComplete: true, removeOnFail: false },
    );

    return {
      script: this.toScriptResponse(saved),
      task_id: stableTaskId,
      status: 'queued',
    };
  }

  async create(data: CreateScriptRequest) {
    const script = await this.scriptsRepository.save(
      this.scriptsRepository.create({
        merchantId: DEFAULT_MERCHANT_ID,
        productInfo: data.product_info,
        templateId: data.template_id ?? null,
        referenceId: data.reference_id ?? null,
        sourceMaterialIds: data.source_material_ids ?? [],
        generationTaskId: null,
        generationError: null,
        mode: data.mode,
        narrativeFramework: data.narrative_framework ?? '',
        visualStyle: data.visual_style ?? '',
        totalDuration: data.total_duration ?? this.sumSceneDuration(data.scenes ?? []) ?? 15,
        status: 'draft',
      }),
    );

    const scenes = await this.replaceScenes(script.id, data.scenes ?? []);
    return this.toScriptResponse({ ...script, scenes });
  }

  batchGenerate() {
    return { task_id: 'script_batch_generation_stub', status: 'queued' as const, count: 0 };
  }

  async findAll(query: ScriptListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.max(Number(query.pageSize ?? 20), 1);
    const qb = this.scriptsRepository
      .createQueryBuilder('script')
      .where('script.merchant_id = :merchantId', { merchantId: DEFAULT_MERCHANT_ID })
      .orderBy('script.created_at', 'DESC');

    if (query.status) qb.andWhere('script.status = :status', { status: query.status });
    if (query.mode) qb.andWhere('script.mode = :mode', { mode: query.mode });
    if (query.keyword) {
      qb.andWhere("script.product_info->>'name' ILIKE :keyword", { keyword: `%${query.keyword}%` });
    }

    const [scripts, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const scriptIds = scripts.map((script) => script.id);
    const scenes =
      scriptIds.length > 0
        ? await this.scenesRepository.find({ where: { scriptId: In(scriptIds) }, order: { order: 'ASC' } })
        : [];
    const scenesByScriptId = new Map<string, Scene[]>();
    for (const scene of scenes) {
      const current = scenesByScriptId.get(scene.scriptId) ?? [];
      current.push(scene);
      scenesByScriptId.set(scene.scriptId, current);
    }
    const items = scripts.map((script) => ({ ...script, scenes: scenesByScriptId.get(script.id) ?? [] }) as Script);

    return {
      items: items.map((script) => this.toScriptResponse(script)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const script = await this.scriptsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
      relations: { scenes: true },
      order: { scenes: { order: 'ASC' } },
    });
    if (!script) throw new NotFoundException('Script not found');
    return this.toScriptResponse(script);
  }

  async update(id: string, data: UpdateScriptRequest) {
    const script = await this.findRawScript(id);
    if (data.narrative_framework !== undefined) script.narrativeFramework = data.narrative_framework;
    if (data.visual_style !== undefined) script.visualStyle = data.visual_style;
    if (data.status !== undefined) {
      script.status = data.status;
      if (data.status !== 'failed') script.generationError = null;
    }
    return this.toScriptResponse(await this.scriptsRepository.save(script));
  }

  async updateScene(id: string, sceneId: string, data: UpdateSceneRequest) {
    await this.findRawScript(id);
    const scene = await this.scenesRepository.findOne({ where: { id: sceneId, scriptId: id } });
    if (!scene) throw new NotFoundException('Scene not found');
    Object.assign(scene, this.toSceneEntityPatch(data));
    return this.toSceneResponse(await this.scenesRepository.save(scene));
  }

  async addScene(id: string, data: AddSceneRequest) {
    await this.findRawScript(id);
    const existing = await this.scenesRepository.find({ where: { scriptId: id }, order: { order: 'ASC' } });
    const insertOrder = data.after_order + 1;
    for (const scene of existing.filter((scene) => scene.order >= insertOrder)) {
      scene.order += 1;
      await this.scenesRepository.save(scene);
    }
    const scene = this.scenesRepository.create({
      scriptId: id,
      order: insertOrder,
      ...this.toSceneEntityPatch(data.scene),
    });
    return this.toSceneResponse(await this.scenesRepository.save(scene));
  }

  async removeScene(id: string, sceneId: string) {
    await this.findRawScript(id);
    const scene = await this.scenesRepository.findOne({ where: { id: sceneId, scriptId: id } });
    if (!scene) throw new NotFoundException('Scene not found');
    await this.scenesRepository.remove(scene);
    return { message: 'deleted' };
  }

  async reorderScenes(id: string, data: ReorderScenesRequest | string[]) {
    await this.findRawScript(id);
    const sceneIds = Array.isArray(data) ? data : data.scene_ids;
    const scenes = await this.scenesRepository.find({ where: { scriptId: id } });
    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    const reordered: Scene[] = [];
    for (const [index, sceneId] of sceneIds.entries()) {
      const scene = byId.get(sceneId);
      if (!scene) continue;
      scene.order = index + 1;
      reordered.push(await this.scenesRepository.save(scene));
    }
    return reordered.map((scene) => this.toSceneResponse(scene));
  }

  async regenerateScene(id: string, sceneId: string) {
    const scene = await this.scenesRepository.findOne({ where: { id: sceneId, scriptId: id } });
    if (!scene) throw new NotFoundException('Scene not found');
    scene.dialogue = scene.dialogue || 'AI regenerated dialogue placeholder';
    scene.visualPrompt = scene.visualPrompt || scene.description;
    return this.toSceneResponse(await this.scenesRepository.save(scene));
  }

  async confirm(id: string) {
    const script = await this.findRawScript(id);
    script.status = 'confirmed';
    return this.toScriptResponse(await this.scriptsRepository.save(script));
  }

  async retry(id: string) {
    const script = await this.findRawScript(id);
    if (script.status !== 'failed') throw new BadRequestException('Only failed scripts can be retried');
    const taskId = `script_generation_${script.id}`;
    const template = script.templateId ? await this.templatesService.findRawById(script.templateId) : null;
    const materialContext = await this.buildMaterialContext(script.sourceMaterialIds ?? []);
    script.status = 'generating';
    script.generationTaskId = taskId;
    script.generationError = null;
    await this.scriptsRepository.save(script);
    await this.scriptQueue.add(
      'generate',
      {
        taskId,
        scriptId: script.id,
        productInfo: script.productInfo,
        mode: script.mode,
        template,
        materialContext,
      },
      { attempts: 2, removeOnComplete: true, removeOnFail: false },
    );
    return { task_id: taskId, status: 'queued' as const };
  }

  async remove(id: string) {
    const script = await this.findRawScript(id);
    await this.scriptsRepository.remove(script);
    return { message: 'deleted' };
  }

  private async findRawScript(id: string) {
    const script = await this.scriptsRepository.findOne({
      where: { id, merchantId: DEFAULT_MERCHANT_ID },
      relations: { scenes: true },
    });
    if (!script) throw new NotFoundException('Script not found');
    return script;
  }

  private async buildMaterialContext(materialIds: string[]) {
    if (materialIds.length === 0) return '';
    const materials = await this.materialsRepository.findBy({ id: In(materialIds), merchantId: DEFAULT_MERCHANT_ID });
    return materials
      .map((material) =>
        [
          `Material ${material.id}`,
          `filename=${material.filename}`,
          `type=${material.type}`,
          `category=${material.category ?? ''}`,
          `status=${material.status}`,
          `tags=${(material.tags ?? []).join(',')}`,
          `ai_tags=${(material.aiTags ?? []).join(',')}`,
          `ai_description=${material.aiDescription ?? ''}`,
        ].join('; '),
      )
      .join('\n');
  }

  private async replaceScenes(scriptId: string, scenes: CreateScriptRequest['scenes']) {
    await this.scenesRepository.delete({ scriptId });
    const saved: Scene[] = [];
    for (const [index, scene] of (scenes ?? []).entries()) {
      saved.push(
        await this.scenesRepository.save(
          this.scenesRepository.create({
            scriptId,
            order: index + 1,
            ...this.toSceneEntityPatch(scene),
          }),
        ),
      );
    }
    return saved;
  }

  private sumSceneDuration(scenes: CreateScriptRequest['scenes']) {
    if (!scenes || scenes.length === 0) return undefined;
    return scenes.reduce((sum, scene) => sum + (scene.duration ?? 3), 0);
  }

  private toSceneEntityPatch(data: Partial<SceneResponse> | NonNullable<CreateScriptRequest['scenes']>[number]) {
    return {
      description: data.description ?? '',
      cameraMotion: data.camera_motion ?? 'fixed',
      duration: data.duration ?? 3,
      dialogue: data.dialogue ?? '',
      bgmStyle: data.bgm_style ?? 'upbeat',
      subtitle: data.subtitle ?? data.dialogue ?? '',
      visualPrompt: data.visual_prompt ?? data.description ?? '',
      constraints: data.constraints ?? [],
    };
  }

  private toScriptResponse(script: Script): ScriptResponse {
    const scenes = [...(script.scenes ?? [])].sort((a, b) => a.order - b.order);
    return {
      id: script.id,
      product_info: script.productInfo,
      template_id: script.templateId ?? undefined,
      reference_id: script.referenceId ?? undefined,
      source_material_ids: script.sourceMaterialIds ?? [],
      generation_task_id: script.generationTaskId ?? undefined,
      generation_error: script.generationError ?? undefined,
      mode: script.mode,
      narrative_framework: script.narrativeFramework ?? '',
      visual_style: script.visualStyle ?? '',
      total_duration: Number(script.totalDuration),
      scenes: scenes.map((scene) => this.toSceneResponse(scene)),
      status: script.status,
      created_at: script.createdAt.toISOString(),
      updated_at: script.updatedAt.toISOString(),
    };
  }

  private toSceneResponse(scene: Scene): SceneResponse {
    return {
      id: scene.id,
      order: scene.order,
      description: scene.description ?? '',
      camera_motion: scene.cameraMotion ?? '',
      duration: Number(scene.duration),
      dialogue: scene.dialogue ?? '',
      bgm_style: scene.bgmStyle ?? '',
      subtitle: scene.subtitle ?? '',
      visual_prompt: scene.visualPrompt ?? '',
      constraints: scene.constraints ?? [],
    };
  }
}
