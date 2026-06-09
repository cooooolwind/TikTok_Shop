// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Script } from '@aigc/shared-types';
import ScriptEditor from './ScriptEditor';

const updateScript = vi.fn();
const fetchDetail = vi.fn();
const resetCurrentScript = vi.fn();

const script: Script = {
  id: 'script-1',
  product_info: {
    name: 'Robot Cleaner',
    description: 'A structured video idea',
    category: 'creative',
    selling_points: [],
    images: ['https://example.com/product.png'],
  },
  mode: 'free',
  narrative_framework: '基础设定 -> 分镜动作',
  visual_style: '复古真实质感',
  total_duration: 8,
  script_blueprint: {
    basic_setting: '机器人清道夫在复古街道中出现。',
    atmosphere_and_quality: '暖橙与海盐蓝色调，真实拍摄质感。',
    audio: '仅保留同期声。',
    scenes: [
      {
        order: 1,
        time_range: '00:00-00:04',
        shot_size: '大全景',
        composition: '道路引导线构图',
        camera_movement: '缓慢上摇',
        visual_content: '主体从画面下方进入街道。',
        audio: '风声。',
      },
    ],
  },
  scenes: [
    {
      id: 'scene-1',
      order: 1,
      description: '主体从画面下方进入街道。',
      camera_motion: '缓慢上摇',
      duration: 4,
      dialogue: '',
      bgm_style: '同期声',
      subtitle: '',
      visual_prompt: '大全景，道路引导线构图，主体从画面下方进入街道。',
      constraints: [],
    },
  ],
  status: 'draft',
  created_at: '2026-06-09T00:00:00.000Z',
  updated_at: '2026-06-09T00:00:00.000Z',
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'script-1' }),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../../stores/useScriptStore', () => ({
  sortScenes: (scenes: Script['scenes']) => [...scenes].sort((a, b) => a.order - b.order),
  useScriptStore: () => ({
    currentScript: script,
    loading: false,
    isDirty: false,
    fetchDetail,
    confirm: vi.fn(),
    remove: vi.fn(),
    retry: vi.fn(),
    updateScript,
    updateScene: vi.fn(),
    addScene: vi.fn(),
    removeScene: vi.fn(),
    regenerateScene: vi.fn(),
    resetCurrentScript,
  }),
}));

vi.mock('../../services/socket', () => ({
  subscribeTask: vi.fn(),
  unsubscribeTask: vi.fn(),
  onScriptGenerated: () => vi.fn(),
  onTaskFailed: () => vi.fn(),
  onTaskProgress: () => vi.fn(),
}));

describe('ScriptEditor blueprint editor', () => {
  beforeAll(() => {
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
  });

  beforeEach(() => {
    updateScript.mockClear();
    fetchDetail.mockClear();
    resetCurrentScript.mockClear();
  });

  it('renders blueprint as primary editor and generated scenes as derived preview', async () => {
    render(<ScriptEditor />);

    expect(screen.getByRole('button', { name: '蓝图编辑' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '剧本蓝图' })).toBeInTheDocument();
    expect(screen.getByAltText('商品图')).toHaveAttribute('src', 'https://example.com/product.png');
    expect(screen.queryByText('由蓝图同步生成')).not.toBeInTheDocument();
    expect(screen.queryByText('description')).not.toBeInTheDocument();
    expect(screen.queryByText(/分镜列表/)).not.toBeInTheDocument();
    expect(screen.queryByText('visual_prompt')).not.toBeInTheDocument();
    expect(screen.queryByText(script.scenes[0].visual_prompt)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '生成预览' }));
    expect(screen.getByText('由蓝图同步生成')).toBeInTheDocument();
    expect(screen.getByText('主体从画面下方进入街道。')).toBeInTheDocument();
    expect(screen.queryByText('visual_prompt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '蓝图编辑' }));
    const basicSetting = screen.getByLabelText('基础设定');
    fireEvent.change(basicSetting, {
      target: { value: '更新后的基础设定，主体和场景保持一致。' },
    });
    fireEvent.change(screen.getByLabelText('分镜 1 画面内容'), {
      target: { value: '更新后的画面内容，主体沿道路高速前进。' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存蓝图并同步分镜/ }));

    await waitFor(() => {
      expect(updateScript).toHaveBeenCalledWith(
        'script-1',
        expect.objectContaining({
          script_blueprint: expect.objectContaining({
            basic_setting: '更新后的基础设定，主体和场景保持一致。',
            scenes: [
              expect.objectContaining({
                visual_content: '更新后的画面内容，主体沿道路高速前进。',
              }),
            ],
          }),
        }),
      );
    });
  });
});
