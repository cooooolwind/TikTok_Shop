// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import TaskCard from './';

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
    video_url: 'https://example.com/video.mp4',
    thumbnail_url: '',
    duration: 8,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    file_size: 123,
  },
  retry_count: 0,
  created_at: '2026-05-25T00:00:00.000Z',
};

describe('TaskCard', () => {
  it('calls onDelete without opening the task detail when the delete button is clicked', () => {
    const onClick = vi.fn();
    const onDelete = vi.fn();

    render(<TaskCard task={task} onClick={onClick} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('delete task'));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });
});
