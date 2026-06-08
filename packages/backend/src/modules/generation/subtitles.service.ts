import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import type { SubtitleCue, SubtitleProject } from '@aigc/shared-types';
import { Scene } from '../scripts/entities/scene.entity';
import { GenerationTask } from './entities/generation-task.entity';

const SUBTITLE_BOUNDARY_GAP_SECONDS = 0.01;

@Injectable()
export class SubtitlesService {
  constructor(
    @InjectRepository(GenerationTask) private readonly tasksRepository: Repository<GenerationTask>,
    @InjectRepository(Scene) private readonly scenesRepository: Repository<Scene>,
    private readonly configService: ConfigService,
  ) {}

  async getProject(taskId: string): Promise<SubtitleProject> {
    const task = await this.findTask(taskId);
    const filePath = this.getSubtitlePath(task.id);

    try {
      const raw = await readFile(filePath, 'utf8');
      const project = this.normalizeProject(JSON.parse(raw) as SubtitleProject, task.id);
      if (project.source === 'script' && this.getGeneratedSceneDurations(task).size > 0) {
        const retimedProject = await this.createFromScript(task);
        await this.writeProject(retimedProject);
        return retimedProject;
      }
      return project;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const project = await this.createFromScript(task);
    await this.writeProject(project);
    return project;
  }

  async saveProject(taskId: string, project: SubtitleProject): Promise<SubtitleProject> {
    await this.findTask(taskId);
    const normalized = this.normalizeProject({ ...project, task_id: taskId, source: 'editor' }, taskId);
    await this.writeProject(normalized);
    return normalized;
  }

  private async createFromScript(task: GenerationTask): Promise<SubtitleProject> {
    const scenes = await this.scenesRepository.find({
      where: { scriptId: task.scriptId },
      order: { order: 'ASC' },
    });
    const generatedDurations = this.getGeneratedSceneDurations(task);
    let cursor = 0;
    const cues: SubtitleCue[] = scenes.flatMap((scene, index) => {
      const duration = this.getSceneDuration(scene, generatedDurations);
      const start = index === 0 ? cursor : cursor + SUBTITLE_BOUNDARY_GAP_SECONDS;
      const end = cursor + duration;
      cursor = end;
      const text = (scene.dialogue || scene.subtitle || '').trim();
      if (!text || end <= start) return [];
      return [
        {
          id: `cue-${scene.id}`,
          start_seconds: this.roundSeconds(start),
          end_seconds: this.roundSeconds(end),
          text,
        },
      ];
    });

    return {
      version: 1,
      task_id: task.id,
      source: 'script',
      cues,
      updated_at: new Date().toISOString(),
    };
  }

  private getGeneratedSceneDurations(task: GenerationTask): Map<number, number> {
    const durations = new Map<number, number>();
    for (const segment of task.result?.segments ?? []) {
      const duration = Number(segment.duration);
      const sceneOrders = segment.scene_orders ?? [];
      if (!Number.isFinite(duration) || duration <= 0 || sceneOrders.length === 0) continue;

      const perSceneDuration = duration / sceneOrders.length;
      for (const order of sceneOrders) {
        durations.set(order, perSceneDuration);
      }
    }
    return durations;
  }

  private getSceneDuration(scene: Scene, generatedDurations: Map<number, number>): number {
    const generatedDuration = generatedDurations.get(scene.order);
    if (
      typeof generatedDuration === 'number' &&
      Number.isFinite(generatedDuration) &&
      generatedDuration > 0
    ) {
      return generatedDuration;
    }

    const scriptedDuration = Number(scene.duration);
    return Number.isFinite(scriptedDuration) && scriptedDuration > 0 ? scriptedDuration : 0;
  }

  private normalizeProject(project: SubtitleProject, taskId: string): SubtitleProject {
    const cues = (project.cues ?? []).map((cue, index) => this.normalizeCue(cue, index));
    return {
      version: 1,
      task_id: taskId,
      source: project.source === 'editor' ? 'editor' : 'script',
      cues,
      updated_at: new Date().toISOString(),
    };
  }

  private normalizeCue(cue: SubtitleCue, index: number): SubtitleCue {
    const start = Number(cue.start_seconds);
    const end = Number(cue.end_seconds);
    const text = String(cue.text ?? '').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      throw new BadRequestException('Invalid subtitle cue timing');
    }
    if (!text) throw new BadRequestException('Subtitle cue text is required');

    return {
      id: cue.id || `cue-${index + 1}`,
      start_seconds: this.roundSeconds(start),
      end_seconds: this.roundSeconds(end),
      text,
    };
  }

  private async writeProject(project: SubtitleProject) {
    const filePath = this.getSubtitlePath(project.task_id);
    await mkdir(join(this.getUploadRoot(), 'subtitles'), { recursive: true });
    await writeFile(filePath, JSON.stringify(project, null, 2), 'utf8');
  }

  private async findTask(taskId: string) {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Generation task not found');
    return task;
  }

  private getSubtitlePath(taskId: string) {
    return join(this.getUploadRoot(), 'subtitles', `${taskId}.json`);
  }

  private getUploadRoot() {
    const storage = this.configService.get<{ localPath?: string }>('storage');
    return storage?.localPath ?? join(process.cwd(), 'uploads');
  }

  private roundSeconds(value: number) {
    return Math.round(value * 1000) / 1000;
  }
}
