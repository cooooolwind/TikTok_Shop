// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import TaskDetail from './TaskDetail';
import { useCreationStore } from '../../stores/useGenerationStore';

vi.mock('../../hooks/useTaskSubscription', () => ({
  useTaskSubscription: vi.fn(),
}));

const doneTask: GenerationTask = {
  id: 'task-1',
  display_id: 'T001',
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
    thumbnail_url: '',
    duration: 12,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    file_size: 1024,
    segments: [
      {
        index: 0,
        video_url: '/uploads/generated/task-1-segment-1.mp4',
        thumbnail_url: '',
        duration: 4,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [1],
      },
    ],
  },
  retry_count: 0,
  created_at: '2026-05-25T00:00:00.000Z',
  completed_at: '2026-05-25T00:01:00.000Z',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/creation/tasks/task-1']}>
      <Routes>
        <Route
          path="/creation/tasks/:taskId"
          element={
            <>
              <TaskDetail />
              <LocationProbe />
            </>
          }
        />
        <Route path="/editor/:taskId" element={<LocationProbe />} />
        <Route path="/creation" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TaskDetail', () => {
  const fetchTask = vi.fn();

  beforeEach(() => {
    window.matchMedia =
      window.matchMedia ??
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
    fetchTask.mockResolvedValue(undefined);
    useCreationStore.setState({
      currentTask: doneTask,
      loading: false,
      creating: false,
      fetchTask,
      retry: vi.fn(),
      cancel: vi.fn(),
      createVideo: vi.fn(),
    });
  });

  it('完成任务点击预览直接进入视频剪辑页', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /预览/ }));

    expect(screen.getByTestId('location').textContent).toBe('/editor/task-1');
  });

  it('任务详情不再展示删除视频和导出完整视频入口', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /删除视频/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /导出完整视频/ })).toBeNull();
  });
});
