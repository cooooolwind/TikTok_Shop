import { describe, expect, it } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import { getDisplayProgress } from './progress';

describe('getDisplayProgress', () => {
  it('returns existing task progress when present', () => {
    const progress = {
      current_step: 2,
      total_steps: 5,
      step_name: 'build_prompt',
      percentage: 40,
      message: 'Building prompt',
      estimated_remaining: 45,
    };

    expect(getDisplayProgress({ status: 'processing', progress })).toBe(progress);
  });

  it('falls back for active tasks without progress', () => {
    const task = { status: 'queued', progress: undefined } as unknown as Pick<GenerationTask, 'status' | 'progress'>;

    expect(getDisplayProgress(task)).toEqual(
      expect.objectContaining({
        current_step: 0,
        total_steps: 5,
        percentage: 0,
      }),
    );
  });
});
