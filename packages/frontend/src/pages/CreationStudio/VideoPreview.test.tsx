// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import VideoPreview from './VideoPreview';
import { useCreationStore } from '../../stores/useGenerationStore';

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
  });

  it('plays the stitched video by default and keeps segment preview switching available', () => {
    renderPreview();

    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('/uploads/generated/task-1.mp4');

    fireEvent.click(screen.getByLabelText('preview segment 2'));

    expect(screen.getByLabelText('video preview').getAttribute('src')).toBe('https://example.com/segment-2.mp4');
  });
});
