// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import VideoPreview from './VideoPreview';
import { useCreationStore } from '../../stores/useGenerationStore';
import { generationApi } from '../../services/generation.api';

vi.mock('../../services/generation.api', () => ({
  generationApi: {
    getSubtitles: vi.fn(),
  },
}));

const task: GenerationTask = {
  id: 'task-1',
  script_id: 'script-1',
  status: 'done',
  progress: {
    current_step: 5,
    total_steps: 5,
    step_name: 'done',
    percentage: 100,
    message: 'done',
    estimated_remaining: 0,
  },
  result: {
    video_url: '/uploads/generated/task-1.mp4',
    thumbnail_url: '/uploads/generated/task-1.png',
    duration: 10,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    file_size: 100,
    segments: [
      {
        index: 0,
        video_url: 'https://example.com/segment-1.mp4',
        thumbnail_url: 'https://example.com/frame-1.png',
        duration: 5,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [1],
      },
      {
        index: 1,
        video_url: 'https://example.com/segment-2.mp4',
        thumbnail_url: 'https://example.com/frame-2.png',
        duration: 5,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [2],
      },
    ],
  },
  retry_count: 0,
  created_at: '2026-05-25T00:00:00.000Z',
};

function renderPreview() {
  return render(
    <MemoryRouter initialEntries={['/creation/tasks/task-1/preview']}>
      <Routes>
        <Route path="/creation/tasks/:taskId/preview" element={<VideoPreview />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VideoPreview', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    useCreationStore.setState({
      currentTask: task,
      fetchTask: vi.fn(),
      exportVideo: vi.fn(),
    });
    vi.mocked(generationApi.getSubtitles).mockResolvedValue({
      version: 1,
      task_id: 'task-1',
      source: 'script',
      cues: [{ id: 'cue-1', start_seconds: 0, end_seconds: 2, text: 'Opening dialogue' }],
    });
  });

  it('plays the stitched video by default and keeps segment preview switching available', async () => {
    renderPreview();
    await waitFor(() => expect(generationApi.getSubtitles).toHaveBeenCalledWith('task-1'));

    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('/uploads/generated/task-1.mp4');
    expect(screen.getByText('视频剪辑')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('preview segment 2'));

    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('https://example.com/segment-2.mp4');
  });

  it('exports in the background and adds a complete video card without navigating away', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const exportVideo = vi.fn().mockResolvedValue({
      download_url: '/uploads/generated/task-1.mp4',
      expires_at: '2026-05-26T00:00:00.000Z',
    });
    const fetchTask = vi.fn();
    useCreationStore.setState({
      currentTask: {
        ...task,
        result: task.result ? { ...task.result, video_url: 'https://example.com/segment-1.mp4' } : undefined,
      },
      exportVideo,
      fetchTask,
    });

    renderPreview();
    fireEvent.click(screen.getByLabelText('导出完整视频'));

    await waitFor(() => expect(generationApi.getSubtitles).toHaveBeenCalledWith('task-1'));
    expect(openSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(exportVideo).toHaveBeenCalledWith('task-1', 'mp4', '1080x1920', 'high'),
    );
    expect(fetchTask).toHaveBeenCalledWith('task-1');

    fireEvent.click(screen.getByLabelText('preview segment 2'));
    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('https://example.com/segment-2.mp4');

    fireEvent.click(screen.getByLabelText('preview complete video'));
    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('/uploads/generated/task-1.mp4');

    openSpy.mockRestore();
  });

  it('loads subtitles and overlays the active dialogue cue during preview playback', async () => {
    renderPreview();

    await waitFor(() => expect(generationApi.getSubtitles).toHaveBeenCalledWith('task-1'));

    const video = screen.getByLabelText('video preview');
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 1 });
    fireEvent.timeUpdate(video);

    const overlay = screen.getByLabelText('subtitle overlay');
    expect(overlay.textContent).toBe('Opening dialogue');
    expect(overlay.style.fontSize).toBe('14px');
  });

  it('does not show the next segment subtitle at the end of a segment preview', async () => {
    vi.mocked(generationApi.getSubtitles).mockResolvedValue({
      version: 1,
      task_id: 'task-1',
      source: 'script',
      cues: [
        { id: 'cue-1', start_seconds: 0, end_seconds: 5, text: 'Opening dialogue' },
        { id: 'cue-2', start_seconds: 5.01, end_seconds: 10, text: 'Second dialogue' },
      ],
    });
    renderPreview();

    await waitFor(() => expect(generationApi.getSubtitles).toHaveBeenCalledWith('task-1'));

    fireEvent.click(screen.getByLabelText('preview segment 1'));
    const video = screen.getByLabelText('video preview');
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 5.02 });
    fireEvent.timeUpdate(video);

    await waitFor(() => expect(screen.queryByLabelText('subtitle overlay')).toBeNull());
  });
});
