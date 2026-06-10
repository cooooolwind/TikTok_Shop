import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AnalyticsDashboardPage from './AnalyticsDashboardPage';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';

vi.mock('../../stores/useAnalyticsStore', () => ({
  useAnalyticsStore: vi.fn(),
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

vi.mock('echarts-for-react', () => ({
    default: () => <div data-testid="echarts-mock" />,
}));

describe('AnalyticsDashboardPage', () => {
  it('renders AnalyticsDashboardPage correctly', () => {
    vi.mocked(useAnalyticsStore).mockReturnValue({
      overview: {
        total_generated: 100,
        success_rate: 0.9,
        avg_generation_time: 12.5,
        total_materials: 200,
        total_scripts: 50,
      },
      attribution: [],
      durationDistribution: [],
      materialDistribution: null,
      overviewLoading: false,
      dateRange: { start_date: '2023-01-01', end_date: '2023-01-07' },
      granularity: 'day',
      setDateRange: vi.fn(),
      setGranularity: vi.fn(),
      fetchOverview: vi.fn(),
      fetchAttribution: vi.fn(),
      fetchDurationDistribution: vi.fn(),
      fetchMaterialDistribution: vi.fn(),
    } as any);

    render(
      <BrowserRouter>
        <AnalyticsDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getAllByText('产出总览').length).toBeGreaterThan(0);
    expect(screen.getByText('100')).toBeDefined(); // total_generated
    expect(screen.getByText('90')).toBeDefined(); // success_rate int
    expect(screen.getByText('12')).toBeDefined(); // avg_generation_time int
    expect(screen.getByText('.5')).toBeDefined(); // avg_generation_time decimal
    expect(screen.getByText('200')).toBeDefined(); // total_materials
    expect(screen.getByText('50')).toBeDefined(); // total_scripts
  });
});
