// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Script } from '@aigc/shared-types';
import CreateTask from './CreateTask';

const createVideoMock = vi.fn();
const navigateMock = vi.fn();
const fetchScriptsMock = vi.fn();
const fetchVoicesMock = vi.fn();
const fetchBgmMock = vi.fn();

const confirmedScript: Script = {
  id: 'script-1',
  product_info: {
    name: 'Summer Dress',
    description: 'Light dress',
    category: 'fashion',
    selling_points: ['light'],
    images: ['https://example.com/dress.png'],
  },
  mode: 'free',
  narrative_framework: 'Hook - demo - CTA',
  visual_style: 'clean',
  total_duration: 12,
  scenes: [],
  status: 'confirmed',
  created_at: '2026-06-10T00:00:00.000Z',
  updated_at: '2026-06-10T00:00:00.000Z',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../stores/useGenerationStore', () => ({
  useCreationStore: () => ({
    creating: false,
    createVideo: createVideoMock,
  }),
}));

vi.mock('../../stores/useScriptStore', () => ({
  useScriptStore: () => ({
    items: [confirmedScript],
    loading: false,
    fetchList: fetchScriptsMock,
  }),
}));

vi.mock('../../stores/useTTSStore', () => ({
  useTTSStore: () => ({
    voices: [],
    loading: false,
    fetchVoices: fetchVoicesMock,
  }),
}));

vi.mock('../../stores/useBGMStore', () => ({
  useBGMStore: () => ({
    items: [],
    loading: false,
    fetchList: fetchBgmMock,
  }),
}));

function renderPage() {
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

  return render(
    <MemoryRouter>
      <CreateTask />
    </MemoryRouter>,
  );
}

describe('CreateTask', () => {
  beforeEach(() => {
    createVideoMock.mockReset();
    navigateMock.mockReset();
    fetchScriptsMock.mockReset();
    fetchVoicesMock.mockReset();
    fetchBgmMock.mockReset();
    createVideoMock.mockResolvedValue({ id: 'task-1' });
  });

  it('submits the user provided task name when creating a video task', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('任务名称'), {
      target: { value: '夏季连衣裙主推视频' },
    });
    fireEvent.mouseDown(screen.getByLabelText('已确认的剧本'));
    fireEvent.click(await screen.findByText(/Summer Dress/));
    fireEvent.click(screen.getByRole('button', { name: /一键成片/ }));

    await waitFor(() => expect(createVideoMock).toHaveBeenCalledTimes(1));
    expect(createVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        script_id: 'script-1',
        display_name: '夏季连衣裙主推视频',
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/creation/tasks/task-1');
  });
});
