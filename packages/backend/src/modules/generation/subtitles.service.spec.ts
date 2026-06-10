import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { SubtitlesService } from './subtitles.service';
import type { GenerationTask } from './entities/generation-task.entity';
import type { Scene } from '../scripts/entities/scene.entity';

const now = new Date('2026-06-06T00:00:00.000Z');

function makeTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: 'task-1',
    scriptId: 'script-1',
    displayName: null,
    status: 'done',
    progress: null,
    result: null,
    error: null,
    retryCount: 0,
    createdAt: now,
    completedAt: null,
    script: undefined as never,
    video: undefined as never,
    ...overrides,
  };
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    scriptId: 'script-1',
    order: 1,
    description: '',
    cameraMotion: '',
    duration: 3,
    dialogue: 'Dialogue text',
    bgmStyle: '',
    subtitle: 'Subtitle text',
    visualPrompt: '',
    constraints: [],
    createdAt: now,
    updatedAt: now,
    script: undefined as never,
    ...overrides,
  };
}

async function makeService() {
  const uploadRoot = await mkdtemp(join(tmpdir(), 'aigc-subtitles-'));
  const tasksRepository = {
    findOne: jest.fn(async () => makeTask()),
  };
  const scenesRepository = {
    find: jest.fn(async () => [
      makeScene({
        id: 'scene-1',
        order: 1,
        duration: 2,
        dialogue: 'Opening dialogue',
        subtitle: 'Opening subtitle',
      }),
      makeScene({ id: 'scene-2', order: 2, duration: 3, subtitle: '', dialogue: 'Second dialogue' }),
    ]),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'storage') return { localPath: uploadRoot };
      return undefined;
    }),
  };
  const service = new SubtitlesService(
    tasksRepository as never,
    scenesRepository as never,
    configService as never,
  );

  return { service, uploadRoot, tasksRepository, scenesRepository };
}

describe('SubtitlesService', () => {
  it('creates a subtitle JSON project from script scenes on first read', async () => {
    const { service, uploadRoot, scenesRepository } = await makeService();
    try {
      const project = await service.getProject('task-1');

      expect(scenesRepository.find).toHaveBeenCalledWith({
        where: { scriptId: 'script-1' },
        order: { order: 'ASC' },
      });
      expect(project).toMatchObject({
        version: 1,
        task_id: 'task-1',
        source: 'script',
        cues: [
          { id: 'cue-scene-1', start_seconds: 0, end_seconds: 2, text: 'Opening dialogue' },
          { id: 'cue-scene-2', start_seconds: 2.01, end_seconds: 5, text: 'Second dialogue' },
        ],
      });
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('uses generated segment durations when initializing subtitle timing', async () => {
    const { service, uploadRoot, tasksRepository } = await makeService();
    tasksRepository.findOne.mockResolvedValueOnce(
      makeTask({
        result: {
          video_url: 'https://example.com/complete.mp4',
          thumbnail_url: '',
          duration: 8,
          resolution: '1080x1920',
          aspect_ratio: '9:16',
          file_size: 0,
          segments: [
            {
              index: 0,
              video_url: 'https://example.com/segment-1.mp4',
              thumbnail_url: '',
              duration: 4,
              resolution: '1080x1920',
              aspect_ratio: '9:16',
              scene_orders: [1],
              status: 'succeeded',
            },
            {
              index: 1,
              video_url: 'https://example.com/segment-2.mp4',
              thumbnail_url: '',
              duration: 4,
              resolution: '1080x1920',
              aspect_ratio: '9:16',
              scene_orders: [2],
              status: 'succeeded',
            },
          ],
        },
      }),
    );

    try {
      const project = await service.getProject('task-1');

      expect(project.cues).toEqual([
        { id: 'cue-scene-1', start_seconds: 0, end_seconds: 4, text: 'Opening dialogue' },
        { id: 'cue-scene-2', start_seconds: 4.01, end_seconds: 8, text: 'Second dialogue' },
      ]);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('retimes existing script subtitles to generated segment durations', async () => {
    const { service, uploadRoot, tasksRepository } = await makeService();
    tasksRepository.findOne.mockResolvedValueOnce(
      makeTask({
        result: {
          video_url: 'https://example.com/complete.mp4',
          thumbnail_url: '',
          duration: 8,
          resolution: '1080x1920',
          aspect_ratio: '9:16',
          file_size: 0,
          segments: [
            {
              index: 0,
              video_url: 'https://example.com/segment-1.mp4',
              thumbnail_url: '',
              duration: 4,
              resolution: '1080x1920',
              aspect_ratio: '9:16',
              scene_orders: [1],
              status: 'succeeded',
            },
            {
              index: 1,
              video_url: 'https://example.com/segment-2.mp4',
              thumbnail_url: '',
              duration: 4,
              resolution: '1080x1920',
              aspect_ratio: '9:16',
              scene_orders: [2],
              status: 'succeeded',
            },
          ],
        },
      }),
    );
    await mkdir(join(uploadRoot, 'subtitles'), { recursive: true });
    await writeFile(
      join(uploadRoot, 'subtitles', 'task-1.json'),
      JSON.stringify({
        version: 1,
        task_id: 'task-1',
        source: 'script',
        cues: [
          { id: 'cue-scene-1', start_seconds: 0, end_seconds: 2, text: 'Opening dialogue' },
          { id: 'cue-scene-2', start_seconds: 2, end_seconds: 5, text: 'Second dialogue' },
        ],
      }),
    );

    try {
      const project = await service.getProject('task-1');

      expect(project.cues).toEqual([
        { id: 'cue-scene-1', start_seconds: 0, end_seconds: 4, text: 'Opening dialogue' },
        { id: 'cue-scene-2', start_seconds: 4.01, end_seconds: 8, text: 'Second dialogue' },
      ]);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('persists edited subtitles and returns the saved file', async () => {
    const { service, uploadRoot } = await makeService();
    try {
      await service.saveProject('task-1', {
        version: 1,
        task_id: 'task-1',
        source: 'editor',
        cues: [{ id: 'cue-custom', start_seconds: 1, end_seconds: 3, text: 'Edited subtitle' }],
      });

      const project = await service.getProject('task-1');

      expect(project.source).toBe('editor');
      expect(project.cues).toEqual([
        { id: 'cue-custom', start_seconds: 1, end_seconds: 3, text: 'Edited subtitle' },
      ]);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('rejects invalid cue timing', async () => {
    const { service, uploadRoot } = await makeService();
    try {
      await expect(
        service.saveProject('task-1', {
          version: 1,
          task_id: 'task-1',
          source: 'editor',
          cues: [{ id: 'cue-bad', start_seconds: 3, end_seconds: 2, text: 'Bad' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it('throws when the generation task does not exist', async () => {
    const { service, uploadRoot, tasksRepository } = await makeService();
    tasksRepository.findOne.mockResolvedValueOnce(null as never);
    try {
      await expect(service.getProject('missing')).rejects.toBeInstanceOf(NotFoundException);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });
});
