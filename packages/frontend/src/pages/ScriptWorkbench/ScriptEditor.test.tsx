// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Script } from '@aigc/shared-types';
import ScriptEditor from './ScriptEditor';

const updateScript = vi.fn();
const fetchDetail = vi.fn();
const resetCurrentScript = vi.fn();
let taskFailedHandler: ((event: { task_id: string; error?: { message: string } }) => void) | undefined;
let currentScript: Script;

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
        dialogue: '镜头看这里，这款清道夫机器人正在穿过复古街道。',
        subtitle: '清道夫机器人登场',
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
      dialogue: '镜头看这里，这款清道夫机器人正在穿过复古街道。',
      bgm_style: '同期声',
      subtitle: '清道夫机器人登场',
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
    currentScript,
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
  onTaskFailed: (handler: typeof taskFailedHandler) => {
    taskFailedHandler = handler;
    return vi.fn();
  },
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
    currentScript = script;
    updateScript.mockClear();
    fetchDetail.mockClear();
    resetCurrentScript.mockClear();
    taskFailedHandler = undefined;
  });

  it('renders blueprint as primary editor and generated scenes as derived preview', async () => {
    render(<ScriptEditor />);

    expect(screen.getByRole('button', { name: '蓝图编辑' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '剧本蓝图' })).toBeInTheDocument();
    expect(screen.getByAltText('商品图')).toHaveAttribute('src', 'https://example.com/product.png');
    expect(screen.queryByLabelText('分镜 1 台词')).not.toBeInTheDocument();
    
    // 展开分镜 1
    fireEvent.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByLabelText('分镜 1 台词')).toHaveValue(
      '镜头看这里，这款清道夫机器人正在穿过复古街道。',
    );
    expect(screen.getByLabelText('分镜 1 字幕')).toHaveValue('清道夫机器人登场');
    expect(screen.queryByText('由蓝图同步生成')).not.toBeInTheDocument();
    expect(screen.queryByText('description')).not.toBeInTheDocument();
    expect(screen.queryByText(/分镜列表/)).not.toBeInTheDocument();
    expect(screen.queryByText('visual_prompt')).not.toBeInTheDocument();
    expect(screen.queryByText(script.scenes[0].visual_prompt)).not.toBeInTheDocument();

    // 折叠分镜 1
    fireEvent.click(screen.getByRole('button', { name: '折叠' }));
    expect(screen.queryByLabelText('分镜 1 台词')).not.toBeInTheDocument();
    expect(screen.getByText('主体从画面下方进入街道。')).toBeInTheDocument();
    
    // 再次展开
    fireEvent.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByLabelText('分镜 1 台词')).toHaveValue(
      '镜头看这里，这款清道夫机器人正在穿过复古街道。',
    );

    fireEvent.click(screen.getByRole('button', { name: '生成预览' }));
    expect(screen.getByText('由蓝图同步生成')).toBeInTheDocument();
    expect(screen.getByText('主体从画面下方进入街道。')).toBeInTheDocument();
    expect(screen.getByText('镜头看这里，这款清道夫机器人正在穿过复古街道。')).toBeInTheDocument();
    expect(screen.queryByText('visual_prompt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '蓝图编辑' }));
    const basicSetting = screen.getByLabelText('基础设定');
    fireEvent.change(basicSetting, {
      target: { value: '更新后的基础设定，主体和场景保持一致。' },
    });
    fireEvent.change(screen.getByLabelText('分镜 1 画面内容'), {
      target: { value: '更新后的画面内容，主体沿道路高速前进。' },
    });
    fireEvent.change(screen.getByLabelText('分镜 1 台词'), {
      target: { value: '更新后的口播台词，商品卖点更清楚。' },
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
                dialogue: '更新后的口播台词，商品卖点更清楚。',
              }),
            ],
          }),
        }),
      );
    });
  });

  it('does not show script generation failure or refetch when a completed script receives a video timeout event', () => {
    render(<ScriptEditor />);

    expect(screen.queryByText('剧本生成失败')).not.toBeInTheDocument();

    taskFailedHandler?.({
      task_id: 'video-task-1',
      error: { message: 'The operation was aborted due to timeout' },
    });

    expect(fetchDetail).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('剧本生成失败')).not.toBeInTheDocument();
  });

  it('does not label an already generated script with scenes as script generation failed', () => {
    currentScript = {
      ...script,
      status: 'failed',
      generation_error: 'The operation was aborted due to timeout',
    };

    render(<ScriptEditor />);

    expect(screen.queryByText('剧本生成失败')).not.toBeInTheDocument();
    expect(screen.getByText('主体从画面下方进入街道。')).toBeInTheDocument();
  });
});
