import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MaterialManagementPage from './MaterialManagementPage';
import { useMaterialStore } from '../../stores/useMaterialStore';

vi.mock('../../stores/useMaterialStore', () => ({
  useMaterialStore: vi.fn(),
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
window.IntersectionObserver =
    window.IntersectionObserver ||
    vi.fn().mockImplementation(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
    }));

describe('MaterialManagementPage', () => {
  it('renders MaterialManagementPage correctly', () => {
    vi.mocked(useMaterialStore).mockReturnValue({
      items: [],
      total: 0,
      loading: false,
      filters: {},
      uploadVisible: false,
      uploading: false,
      uploadProgress: 0,
      fetchList: vi.fn(),
      setFilters: vi.fn(),
      remove: vi.fn(),
      batchRemove: vi.fn(),
      setUploadVisible: vi.fn(),
      upload: vi.fn(),
      semanticSearch: vi.fn(),
      semanticResults: [],
      semanticLoading: false,
    } as any);

    render(
      <BrowserRouter>
        <MaterialManagementPage />
      </BrowserRouter>
    );

    expect(screen.getAllByText('素材管理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('文本搜索').length).toBeGreaterThan(0);
  });
});
