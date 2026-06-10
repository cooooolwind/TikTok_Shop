import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { analyticsApi } from '../../services/analytics.api';

vi.mock('../../services/analytics.api', () => ({
  analyticsApi: {
    homeStats: vi.fn(),
  },
}));

window.ResizeObserver =
    window.ResizeObserver ||
    vi.fn().mockImplementation(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
    }));

window.matchMedia = window.matchMedia || function() {
    return {
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    };
};

describe('HomePage', () => {
  it('renders stats correctly', async () => {
    vi.mocked(analyticsApi.homeStats).mockResolvedValue({
      total_videos: 100,
      total_materials: 200,
      total_scripts: 50,
      success_rate: 0.95,
    });

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(screen.getAllByText('欢迎使用 AIGC 带货视频生成平台').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('100')).toBeDefined(); // total_videos
      expect(screen.getByText('200')).toBeDefined(); // total_materials
      expect(screen.getByText('50')).toBeDefined(); // total_scripts
      expect(screen.getByText('95')).toBeDefined(); // success_rate int
      expect(screen.getByText('.0')).toBeDefined(); // success_rate decimal
    });
  });
});
