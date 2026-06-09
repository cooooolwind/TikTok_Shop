import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
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
import { MaterialsService } from '../materials/materials.service';
import { GenerationTask } from '../generation/entities/generation-task.entity';
import { Video } from '../generation/entities/video.entity';
import { Scene } from './entities/scene.entity';
import { Script } from './entities/script.entity';

const DEFAULT_MERCHANT_ID = 'default';

interface MaterialGenerationInput {
  context: string;
  media: { type: 'image' | 'video'; filename: string; imageUrl?: string; url?: string; thumbnailUrl?: string }[];
  productImageUrls: string[];
}

@Injectable()
export class ScriptsService {
  constructor(
    @InjectRepository(Script) private readonly scriptsRepository: Repository<Script>,
    @InjectRepository(Scene) private readonly scenesRepository: Repository<Scene>,
    @InjectRepository(Material) private readonly materialsRepository: Repository<Material>,
    @InjectRepository(GenerationTask) private readonly generationTasksRepository: Repository<GenerationTask>,
    @InjectRepository(Video) private readonly videosRepository: Repository<Video>,
    private readonly templatesService: TemplatesService,
    private readonly materialsService: MaterialsService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUES.SCRIPT_GENERATION) private readonly scriptQueue: Queue,
  ) {}

  async generate(data: GenerateScriptRequest): Promise<GenerateScriptQueuedResponse> {
    const materialInput = await this.buildMaterialInput(data.material_ids ?? []);
    const productInfo = this.withMaterialProductImages(data.product_info, materialInput.productImageUrls);
    const template = data.template_id ? await this.templatesService.findRawById(data.template_id) : null;
    if (data.template_id && !template) throw new NotFoundException('Template not found');

    const reference = data.reference_id ? await this.materialsService.findOne(data.reference_id) : null;
    if (data.reference_id && !reference) throw new NotFoundException('Reference material not found');
    if (data.mode === 'imitation') {
      if (!reference) throw new BadRequestException('Reference ID is required for imitation mode');
      if (reference.status !== 'ready') throw new BadRequestException('Reference material analysis is not completed yet');
    }

    const taskId = `script_generation_${randomUUID()}`;
    const script = await this.scriptsRepository.save(
      this.scriptsRepository.create({
        merchantId: DEFAULT_MERCHANT_ID,
        productInfo,
        templateId: data.template_id ?? null,
        referenceId: data.reference_id ?? null,
        sourceMaterialIds: data.material_ids ?? [],
        generationTaskId: taskId,
        generationError: null,
        mode: data.mode,
        narrativeFramework: template?.strategy ?? reference?.reference_analysis?.style ?? '',
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
        productInfo,
        mode: data.mode,
        preferences: data.preferences,
        template,
        reference,
        materialContext: materialInput.context,
        materialMedia: materialInput.media,
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
    const materialInput = await this.buildMaterialInput(data.source_material_ids ?? []);
    const productInfo = this.withMaterialProductImages(data.product_info, materialInput.productImageUrls);
    const script = await this.scriptsRepository.save(
      this.scriptsRepository.create({
        merchantId: DEFAULT_MERCHANT_ID,
        productInfo,
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
    const reference = script.referenceId ? await this.materialsService.findOne(script.referenceId) : null;
    const materialInput = await this.buildMaterialInput(script.sourceMaterialIds ?? []);
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
        reference,
        materialContext: materialInput.context,
        materialMedia: materialInput.media,
      },
      { attempts: 2, removeOnComplete: true, removeOnFail: false },
    );
    return { task_id: taskId, status: 'queued' as const };
  }

  async remove(id: string) {
    const script = await this.findRawScript(id);
    await this.videosRepository.delete({ scriptId: id });
    await this.generationTasksRepository.delete({ scriptId: id });
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

  private async buildMaterialInput(materialIds: string[]): Promise<MaterialGenerationInput> {
    if (materialIds.length === 0) return { context: '', media: [], productImageUrls: [] };
    const materials = await this.materialsRepository.find({
      where: { id: In(materialIds), merchantId: DEFAULT_MERCHANT_ID },
      relations: { slices: true },
    });
    const context = materials
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
          ...[...(material.slices ?? [])]
            .sort((a, b) => Number(a.startTime) - Number(b.startTime))
            .map(
              (slice, index) =>
                `slice ${index + 1}: ${Number(slice.startTime)}-${Number(slice.endTime)}s; description=${slice.description ?? ''}; tags=${(slice.tags ?? []).join(',')}`,
            ),
        ].join('; '),
      )
      .join('\n');
    const media = await Promise.all(materials.map((material) => this.toMaterialMedia(material)));
    const imageMaterials = materials
      .filter((material) => material.type === 'image' && material.url)
      .sort((a, b) => {
        const aProduct = a.category === 'product' ? 0 : 1;
        const bProduct = b.category === 'product' ? 0 : 1;
        return aProduct - bProduct;
      });
    return {
      context,
      media: media.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      productImageUrls: imageMaterials.map((material) => material.url),
    };
  }

  private withMaterialProductImages(productInfo: GenerateScriptRequest['product_info'], materialImageUrls: string[]) {
    const images = [...new Set([...(productInfo.images ?? []), ...materialImageUrls].filter(Boolean))];
    return images.length > 0 ? { ...productInfo, images } : productInfo;
  }

  private async toMaterialMedia(material: Material) {
    if (material.type === 'image') {
      const imageUrl = await this.toImageDataUrl(material);
      return imageUrl ? { type: 'image' as const, filename: material.filename, imageUrl } : null;
    }

    return {
      type: 'video' as const,
      filename: material.filename,
      url: material.url,
      thumbnailUrl: material.thumbnailUrl ?? undefined,
    };
  }

  private async toImageDataUrl(material: Material) {
    try {
      const storage = this.configService.get<{ localPath: string }>('storage');
      const localPath = storage?.localPath ?? join(process.cwd(), 'uploads');
      const relative = material.url.replace(/^\/uploads\/?/, '');
      const filePath = join(localPath, relative || basename(material.url));
      const bytes = await fs.readFile(filePath);
      const mimeType = material.mimeType || 'image/jpeg';
      return `data:${mimeType};base64,${bytes.toString('base64')}`;
    } catch {
      return undefined;
    }
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
