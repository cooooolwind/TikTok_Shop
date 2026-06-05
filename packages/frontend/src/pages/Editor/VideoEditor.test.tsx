// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import VideoEditor from './VideoEditor';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useEditorStore } from '../../stores/useEditorStore';

vi.mock('./components/Preview/RemotionPreview', () => ({
  default: () => <div data-testid="remotion-preview">整体预览播放器</div>,
}));

const multiSegmentTask: GenerationTask = {
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
    video_url: '/uploads/generated/task-1.mp4',
    thumbnail_url: '',
    duration: 18,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    file_size: 100,
    segments: [
      {
        index: 0,
        video_url: 'https://example.com/segment-1.mp4',
        thumbnail_url: 'https://example.com/segment-1.jpg',
        duration: 5,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [1],
      },
      {
        index: 1,
        video_url: 'https://example.com/segment-2.mp4',
        thumbnail_url: '',
        duration: 6,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [2],
      },
      {
        index: 2,
        video_url: 'https://example.com/segment-3.mp4',
        thumbnail_url: 'https://example.com/segment-3.jpg',
        duration: 7,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [3],
      },
    ],
  },
  retry_count: 0,
  created_at: '2026-05-25T00:00:00.000Z',
};

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/editor/task-1']}>
      <Routes>
        <Route path="/editor/:taskId" element={<VideoEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createDataTransfer() {
  const data = new Map<string, string>();
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn((type: string, value: string) => data.set(type, value)),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setDragImage: vi.fn(),
  };
}

function seedTimeline() {
  act(() => {
    useEditorStore.getState().setClips([
      { id: 'clip-0', segment_index: 0, start_seconds: 0, end_seconds: 5 },
      { id: 'clip-1', segment_index: 1, start_seconds: 0, end_seconds: 6 },
      { id: 'clip-2', segment_index: 2, start_seconds: 0, end_seconds: 7 },
    ]);
  });
}

describe('VideoEditor', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    document.documentElement.setAttribute('data-theme', 'light');
    useCreationStore.setState({
      currentTask: multiSegmentTask,
      fetchTask: vi.fn(),
    });
    useEditorStore.getState().resetEditor();
  });

  it('渲染正常中文的桌面剪辑工作台', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('剪辑工作台')).toBeTruthy();
    });
    expect(screen.getByTestId('editor-shell')).toBeTruthy();
    expect(screen.getByText('资源与工具')).toBeTruthy();
    expect(screen.getByText('片段属性')).toBeTruthy();
    expect(screen.getByText('多轨时间线')).toBeTruthy();
    expect(screen.getByRole('button', { name: '素材片段' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '转场' })).toBeTruthy();
  });

  it('进入剪辑页后展示素材列表但时间线保持为空', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByAltText('第 1 段缩略图').getAttribute('src')).toBe(
        'https://example.com/segment-1.jpg',
      );
    });
    expect(screen.getByLabelText('第 2 段占位缩略图')).toBeTruthy();
    expect(useEditorStore.getState().clips).toHaveLength(0);
    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(screen.queryByAltText('时间线第 1 段缩略图')).toBeNull();
  });

  it('点击素材加入后只新增对应片段且不自动创建默认转场', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByAltText('第 1 段缩略图')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /加入/ })[0]);

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(1);
    });
    expect(useEditorStore.getState().clips[0]).toMatchObject({
      id: 'clip-0',
      segment_index: 0,
      start_seconds: 0,
      end_seconds: 5,
    });
    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(screen.getByAltText('时间线第 1 段缩略图').getAttribute('src')).toBe(
      'https://example.com/segment-1.jpg',
    );
  });

  it('素材片段和时间线片段优先渲染缩略图，缺失时显示占位', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByAltText('第 1 段缩略图').getAttribute('src')).toBe(
        'https://example.com/segment-1.jpg',
      );
    });
    expect(screen.getByLabelText('第 2 段占位缩略图')).toBeTruthy();
    const addButtons = screen.getAllByRole('button', { name: /加入/ });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(2);
    });
    expect(screen.getByAltText('时间线第 1 段缩略图').getAttribute('src')).toBe(
      'https://example.com/segment-1.jpg',
    );
    expect(screen.getByLabelText('时间线第 2 段占位缩略图')).toBeTruthy();
  });

  it('只显示放大的整体预览，不再出现基础预览切换', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('整体预览')).toBeTruthy();
    });
    expect(screen.getByTestId('preview-stage')).toBeTruthy();
    expect(screen.getByTestId('remotion-preview')).toBeTruthy();
    expect(screen.queryByText('基础预览')).toBeNull();
  });

  it('转场预设可拖入两个片段之间的间隙并创建转场', async () => {
    renderEditor();
    seedTimeline();

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(3);
    });

    fireEvent.click(screen.getByRole('button', { name: '转场' }));
    const slidePreset = screen.getByRole('button', { name: '滑动' });
    expect(slidePreset.getAttribute('draggable')).toBe('true');

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(slidePreset, { dataTransfer });
    fireEvent.drop(screen.getByTestId('transition-drop-zone-0'), { dataTransfer });

    expect(useEditorStore.getState().transitions).toHaveLength(1);
    expect(useEditorStore.getState().transitions[0]).toMatchObject({
      from_clip_id: 'clip-0',
      to_clip_id: 'clip-1',
      type: 'slide',
    });
    expect(screen.getAllByText('滑动').length).toBeGreaterThan(0);
  });

  it('无效转场投放不创建数据并显示提示', async () => {
    renderEditor();
    seedTimeline();

    await waitFor(() => {
      expect(screen.getByTestId('timeline-inner')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '转场' }));
    const wipePreset = screen.getByRole('button', { name: '擦除' });
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(wipePreset, { dataTransfer });
    fireEvent.drop(screen.getByTestId('timeline-inner'), { dataTransfer });

    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(screen.getByText('请把转场拖到两个片段之间的间隙')).toBeTruthy();
  });

  it('拖入无转场到已有转场间隙时删除该转场', async () => {
    renderEditor();
    seedTimeline();

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(3);
    });
    act(() => {
      useEditorStore.getState().upsertTransitionBetween('clip-0', 'clip-1', 'fade');
    });
    expect(useEditorStore.getState().transitions).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '转场' }));
    const nonePreset = screen.getByRole('button', { name: '无转场' });
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(nonePreset, { dataTransfer });
    fireEvent.drop(screen.getByTestId('transition-drop-zone-0'), { dataTransfer });

    expect(useEditorStore.getState().transitions).toHaveLength(0);
  });

  it('移动端仍提示用户在电脑端使用', async () => {
    mockMatchMedia(true);

    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('剪辑工作台建议在电脑端使用')).toBeTruthy();
    });
    expect(screen.getByText('返回任务详情')).toBeTruthy();
    expect(screen.queryByText('多轨时间线')).toBeNull();
  });
  it('选中转场后可以在右侧属性面板删除转场', async () => {
    renderEditor();
    seedTimeline();

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(3);
    });
    act(() => {
      useEditorStore.getState().upsertTransitionBetween('clip-0', 'clip-1', 'fade');
    });

    expect(useEditorStore.getState().transitions).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '删除转场' }));

    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(useEditorStore.getState().selection).toBeNull();
  });
});
