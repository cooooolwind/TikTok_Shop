import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { stat, rm, writeFile } from 'fs/promises';
import { VideoStitchingService } from './video-stitching.service';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(async () => undefined),
  rm: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({ size: 9876 })),
  writeFile: jest.fn(async () => undefined),
}));

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function makeConfig(localPath = 'uploads-test') {
  return {
    get: jest.fn((key: string) => (key === 'storage' ? { localPath } : undefined)),
  };
}

function mockFetch(body = 'video') {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => Buffer.from(body),
  })) as never;
}

function mockSpawnExit(code = 0, stderr = '') {
  const child = new EventEmitter() as ReturnType<typeof spawn>;
  Object.assign(child, {
    stderr: Readable.from(stderr ? [stderr] : []),
  });
  mockedSpawn.mockReturnValue(child);
  setImmediate(() => child.emit('close', code));
}

describe('VideoStitchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch();
    mockSpawnExit();
  });

  it('downloads segments, writes a concat list, runs ffmpeg, and returns the generated upload URL', async () => {
    const service = new VideoStitchingService(makeConfig() as never);

    const result = await service.stitch({
      taskId: 'task-1',
      segments: [
        { index: 0, video_url: 'https://example.com/segment-1.mp4' },
        { index: 1, video_url: 'https://example.com/segment-2.mp4' },
      ],
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('concat.txt'),
      expect.stringContaining("file '"),
      'utf8',
    );
    expect(mockedSpawn).toHaveBeenCalledWith(
      expect.stringMatching(/ffmpeg(\.exe)?$/),
      expect.arrayContaining(['-f', 'concat', '-safe', '0', '-c', 'copy']),
      expect.objectContaining({ windowsHide: true }),
    );
    expect(stat).toHaveBeenCalledWith(expect.stringContaining('task-1.mp4'));
    expect(result).toEqual({ video_url: '/uploads/generated/task-1.mp4', file_size: 9876 });
    expect(rm).toHaveBeenCalledWith(expect.stringContaining('task-1-'), { recursive: true, force: true });
  });

  it('returns a diagnostic error when ffmpeg exits unsuccessfully', async () => {
    mockSpawnExit(1, 'Invalid data found when processing input');
    const service = new VideoStitchingService(makeConfig() as never);

    await expect(
      service.stitch({
        taskId: 'task-1',
        segments: [
          { index: 0, video_url: 'https://example.com/segment-1.mp4' },
          { index: 1, video_url: 'https://example.com/segment-2.mp4' },
        ],
      }),
    ).rejects.toThrow('ffmpeg exited with code 1: Invalid data found when processing input');
  });

  it('returns a diagnostic error when ffmpeg is missing', async () => {
    const child = new EventEmitter() as ReturnType<typeof spawn>;
    Object.assign(child, { stderr: new EventEmitter() });
    mockedSpawn.mockReturnValue(child);
    setImmediate(() => child.emit('error', new Error('spawn ffmpeg ENOENT')));
    const service = new VideoStitchingService(makeConfig() as never);

    await expect(
      service.stitch({
        taskId: 'task-1',
        segments: [
          { index: 0, video_url: 'https://example.com/segment-1.mp4' },
          { index: 1, video_url: 'https://example.com/segment-2.mp4' },
        ],
      }),
    ).rejects.toThrow('ffmpeg not available: spawn ffmpeg ENOENT');
  });
});
