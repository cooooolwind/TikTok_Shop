// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '@aigc/shared-types';
import VideoEditor from './VideoEditor';
import { useCreationStore } from '../../stores/useGenerationStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { generationApi } from '../../services/generation.api';
import { downloadExportUrl } from '../../utils/exportWindow';

vi.mock('./components/Preview/RemotionPreview', () => ({
  default: () => <div data-testid="remotion-preview">整体预览播放器</div>,
}));

vi.mock('../../services/generation.api', () => ({
  generationApi: {
    getSubtitles: vi.fn(async () => ({
      version: 1,
      task_id: 'task-1',
      source: 'script',
      cues: [
        { id: 'cue-1', start_seconds: 0, end_seconds: 2, text: 'Opening subtitle' },
        { id: 'cue-2', start_seconds: 2, end_seconds: 5, text: 'Second subtitle' },
      ],
    })),
    saveSubtitles: vi.fn(async (taskId, project) => ({ ...project, task_id: taskId })),
    export: vi.fn(async () => ({
      download_url: '/uploads/generated/task-1-remotion.mp4',
      expires_at: '2026-06-07T00:00:00.000Z',
      source: 'remotion',
      segments_count: 2,
    })),
  },
}));

vi.mock('../../utils/exportWindow', () => ({
  downloadExportUrl: vi.fn(),
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

const shortSegmentTask: GenerationTask = {
  ...multiSegmentTask,
  id: 'task-2',
  script_id: 'script-2',
  result: {
    ...multiSegmentTask.result!,
    video_url: '/uploads/generated/task-2.mp4',
    duration: 5,
    segments: [
      {
        index: 0,
        video_url: 'https://example.com/task-2-segment-1.mp4',
        thumbnail_url: 'https://example.com/task-2-segment-1.jpg',
        duration: 2,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [1],
      },
      {
        index: 1,
        video_url: 'https://example.com/task-2-segment-2.mp4',
        thumbnail_url: 'https://example.com/task-2-segment-2.jpg',
        duration: 3,
        resolution: '1080x1920',
        aspect_ratio: '9:16',
        scene_orders: [2],
      },
    ],
  },
};

function renderEditor({ strict = false, taskId = 'task-1' }: { strict?: boolean; taskId?: string } = {}) {
  const view = (
    <MemoryRouter initialEntries={[`/editor/${taskId}`]}>
      <Routes>
        <Route path="/editor/:taskId" element={<VideoEditor />} />
      </Routes>
    </MemoryRouter>
  );

  return render(strict ? <StrictMode>{view}</StrictMode> : view);
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
    vi.mocked(generationApi.getSubtitles).mockClear();
    vi.mocked(generationApi.saveSubtitles).mockClear();
    vi.mocked(generationApi.export).mockClear();
    vi.mocked(downloadExportUrl).mockClear();
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

  it('进入剪辑页后默认按分镜顺序铺入时间线', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByAltText('第 1 段缩略图').getAttribute('src')).toBe(
        'https://example.com/segment-1.jpg',
      );
    });
    expect(screen.getByLabelText('第 2 段占位缩略图')).toBeTruthy();
    expect(useEditorStore.getState().clips).toEqual([
      { id: 'clip-0', segment_index: 0, start_seconds: 0, end_seconds: 5 },
      { id: 'clip-1', segment_index: 1, start_seconds: 0, end_seconds: 6 },
      { id: 'clip-2', segment_index: 2, start_seconds: 0, end_seconds: 7 },
    ]);
    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(screen.getByAltText('时间线第 1 段缩略图')).toBeTruthy();
  });

  it('严格模式重新挂载后仍默认铺入时间线', async () => {
    renderEditor({ strict: true });

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toEqual([
        { id: 'clip-0', segment_index: 0, start_seconds: 0, end_seconds: 5 },
        { id: 'clip-1', segment_index: 1, start_seconds: 0, end_seconds: 6 },
        { id: 'clip-2', segment_index: 2, start_seconds: 0, end_seconds: 7 },
      ]);
    });
  });

  it('切换到新剪辑任务时不会用旧任务分镜时长初始化时间线', async () => {
    useCreationStore.setState({
      currentTask: multiSegmentTask,
      fetchTask: vi.fn(async () => {
        useCreationStore.setState({ currentTask: shortSegmentTask });
      }),
    });

    renderEditor({ taskId: 'task-2' });

    await waitFor(() => {
      expect(useCreationStore.getState().currentTask?.id).toBe('task-2');
      expect(useEditorStore.getState().clips).toEqual([
        { id: 'clip-0', segment_index: 0, start_seconds: 0, end_seconds: 2 },
        { id: 'clip-1', segment_index: 1, start_seconds: 0, end_seconds: 3 },
      ]);
    });
  });

  it('用户删除时间线片段后不会被默认初始化再次填回', async () => {
    renderEditor();

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(3);
    });
    act(() => {
      useEditorStore.getState().removeClip('clip-0');
      useEditorStore.getState().removeClip('clip-1');
      useEditorStore.getState().removeClip('clip-2');
    });

    expect(useEditorStore.getState().clips).toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useEditorStore.getState().clips).toHaveLength(0);
  });

  it('点击已在时间线的素材片段时定位对应片段且不重复添加', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByAltText('第 1 段缩略图')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /定位/ })[0]);

    expect(useEditorStore.getState().clips).toHaveLength(3);
    expect(useEditorStore.getState().clips[0]).toMatchObject({
      id: 'clip-0',
      segment_index: 0,
      start_seconds: 0,
      end_seconds: 5,
    });
    expect(useEditorStore.getState().transitions).toHaveLength(0);
    expect(useEditorStore.getState().selection).toEqual({ type: 'clip', id: 'clip-0' });
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

    await waitFor(() => {
      expect(useEditorStore.getState().clips).toHaveLength(3);
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

  it('时间轴缩放只影响时间轴，不改变整体预览容器结构', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByTestId('timeline-inner')).toBeTruthy();
    });

    const timelineWidth = screen.getByTestId('timeline-inner').style.width;
    const subtitleTrackWidth = screen.getByTestId('subtitle-track-inner').style.width;
    const previewPanel = screen.getByTestId('preview-panel');
    const previewPanelStyle = previewPanel.getAttribute('style');
    const previewFrame = screen.getByTestId('preview-frame');
    const previewClassName = previewFrame.className;
    const previewStyle = previewFrame.getAttribute('style');
    const previewPlayer = screen.getByTestId('remotion-preview');

    act(() => {
      useEditorStore.getState().setZoom(180);
    });

    expect(useEditorStore.getState().pixelsPerSecond).toBe(180);
    expect(screen.getByTestId('timeline-inner').style.width).not.toBe(timelineWidth);
    expect(screen.getByTestId('subtitle-track-inner').style.width).not.toBe(subtitleTrackWidth);
    expect(screen.getByTestId('preview-panel')).toBe(previewPanel);
    expect(screen.getByTestId('preview-panel').getAttribute('style')).toBe(previewPanelStyle);
    expect(previewPanelStyle).toContain('width: 520px');
    expect(screen.getByTestId('preview-frame')).toBe(previewFrame);
    expect(screen.getByTestId('preview-frame').className).toBe(previewClassName);
    expect(screen.getByTestId('preview-frame').getAttribute('style')).toBe(previewStyle);
    expect(previewStyle).toContain('width: 300px');
    expect(previewStyle).toContain('height: 533px');
    expect(screen.getByTestId('remotion-preview')).toBe(previewPlayer);
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
  it('加载字幕文件后可编辑字幕并在导出时提交字幕工程', async () => {
    renderEditor();
    seedTimeline();

    await waitFor(() => {
      expect(useEditorStore.getState().subtitles).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: '字幕' }));
    fireEvent.click(screen.getAllByText('Opening subtitle')[0]);
    fireEvent.change(screen.getByLabelText('subtitle text'), {
      target: { value: 'Edited subtitle' },
    });

    await waitFor(() => {
      expect(useEditorStore.getState().subtitles[0].text).toBe('Edited subtitle');
    });

    fireEvent.click(screen.getByLabelText('export transition video'));

    await waitFor(() => {
      expect(generationApi.saveSubtitles).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          source: 'editor',
          cues: expect.arrayContaining([
            expect.objectContaining({ id: 'cue-1', text: 'Edited subtitle' }),
          ]),
        }),
      );
      expect(generationApi.export).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          edit_project: expect.objectContaining({
            subtitles: expect.arrayContaining([
              expect.objectContaining({ id: 'cue-1', text: 'Edited subtitle' }),
            ]),
          }),
        }),
      );
      expect(downloadExportUrl).toHaveBeenCalledWith(
        '/uploads/generated/task-1-remotion.mp4',
        'aigc-video-task-1.mp4',
      );
    });
  });
});
