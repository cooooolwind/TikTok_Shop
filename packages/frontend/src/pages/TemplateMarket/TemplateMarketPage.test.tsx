import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TemplateMarketPage from './TemplateMarketPage';
import { useTemplateStore } from '../../stores/useTemplateStore';

vi.mock('../../stores/useTemplateStore', () => ({
  useTemplateStore: vi.fn(),
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

describe('TemplateMarketPage', () => {
  it('renders TemplateMarketPage and fetches template list', () => {
    const fetchListMock = vi.fn();
    vi.mocked(useTemplateStore).mockReturnValue({
      items: [
        {
          id: 'test-template-1',
          name: 'Test Template',
          is_builtin: true,
          strategy: 'Test strategy description',
          applicable_categories: ['product'],
          factors: [{ name: 'Factor 1', value: 'Value 1' }],
          updated_at: '2023-01-01T00:00:00Z',
        }
      ],
      loading: false,
      fetchList: fetchListMock,
    } as any);

    render(
      <BrowserRouter>
        <TemplateMarketPage />
      </BrowserRouter>
    );

    expect(screen.getAllByText('灵感模板广场').length).toBeGreaterThan(0);
    expect(screen.getByText('Test Template')).toBeDefined();
    expect(screen.getByText('内置')).toBeDefined();
    expect(fetchListMock).toHaveBeenCalled();
  });
});
