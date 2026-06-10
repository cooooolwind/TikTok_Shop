import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptGenerate from './ScriptGenerate';

const generateMock = vi.fn();
const createMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../stores/useScriptStore', () => ({
  useScriptStore: () => ({
    generating: false,
    create: createMock,
    generate: generateMock,
  }),
}));

vi.mock('../../stores/useTemplateStore', () => ({
  useTemplateStore: () => ({
    items: [],
    fetchList: vi.fn(),
  }),
}));

vi.mock('../../services/materials.api', () => ({
  materialsApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../../stores/useMaterialStore', () => ({
  useMaterialStore: () => ({
    items: [
      {
        id: 'material-1',
        name: 'Travel clip',
        type: 'video',
        category: 'product',
        status: 'ready',
      },
    ],
    fetchList: vi.fn(),
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
      <ScriptGenerate />
    </MemoryRouter>,
  );
}

describe('ScriptGenerate', () => {
  beforeEach(() => {
    generateMock.mockReset();
    createMock.mockReset();
    navigateMock.mockReset();
    generateMock.mockResolvedValue({
      script: { id: 'script-1' },
      task_id: 'task-1',
      status: 'queued',
    });
  });

  it('defaults to automatic dialogue generation and submits disabled dialogue preference when selected', async () => {
    renderPage();

    expect(screen.getByText('自动判断')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: 'Pocket Camera' } });
    fireEvent.change(screen.getByLabelText('商品类目'), { target: { value: 'electronics' } });
    fireEvent.change(screen.getByLabelText('商品描述'), { target: { value: 'Tiny camera for travel' } });

    fireEvent.mouseDown(screen.getByLabelText('选择图片或视频素材'));
    fireEvent.click(await screen.findByText('Travel clip · 视频 · product · ready'));
    fireEvent.mouseDown(screen.getByLabelText('台词生成'));
    fireEvent.click(await screen.findByText('不生成台词'));
    fireEvent.click(screen.getByRole('button', { name: /提交生成任务/ }));

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          dialogue_mode: 'disabled',
          dialogue_type: 'mixed',
        }),
      }),
    );
  });

  it('shows whole-script duration control and can submit a 30 second target', async () => {
    renderPage();

    expect(screen.getByText('整条剧本目标时长')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: 'Pocket Camera' } });
    fireEvent.change(screen.getByLabelText('商品类目'), { target: { value: 'electronics' } });
    fireEvent.change(screen.getByLabelText('商品描述'), { target: { value: 'Tiny camera for travel' } });
    fireEvent.mouseDown(screen.getByLabelText('选择图片或视频素材'));
    fireEvent.click(await screen.findByText('Travel clip · 视频 · product · ready'));

    expect(screen.getByRole('slider', { name: '整条剧本目标时长' })).toHaveAttribute(
      'aria-valuemax',
      '30',
    );
    fireEvent.change(screen.getByLabelText('整条剧本目标时长秒数'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /提交生成任务/ }));

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          duration: 30,
        }),
      }),
    );
  });
});
