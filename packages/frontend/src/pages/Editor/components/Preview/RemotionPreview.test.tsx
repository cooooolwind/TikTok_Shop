// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoSegmentResult } from '@aigc/shared-types';
import RemotionPreview from './RemotionPreview';
import { useEditorStore } from '../../../../stores/useEditorStore';

const playerListeners = new Map<string, (event: { detail?: { frame?: number } }) => void>();
const seekToMock = vi.fn();
const playMock = vi.fn();
const pauseMock = vi.fn();
let lastPlayerProps: Record<string, unknown> | undefined;
let playerRenderCount = 0;

vi.mock('@remotion/player', () => ({
  Player: React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    lastPlayerProps = props;
    playerRenderCount += 1;
    React.useImperativeHandle(ref, () => ({
      seekTo: seekToMock,
      play: playMock,
      pause: pauseMock,
      getCurrentFrame: () => 0,
      addEventListener: (
        name: string,
        callback: (event: { detail?: { frame?: number } }) => void,
      ) => {
        playerListeners.set(name, callback);
      },
      removeEventListener: (name: string) => {
        playerListeners.delete(name);
      },
    }));

    return <div data-testid="mock-player" />;
  }),
}));

const segment: VideoSegmentResult = {
  index: 0,
  video_url: 'https://example.com/segment-1.mp4',
  thumbnail_url: 'https://example.com/segment-1.jpg',
  duration: 5,
  resolution: '1080x1920',
  aspect_ratio: '9:16',
  scene_orders: [1],
};
const segmentMap = new Map([[0, segment]]);

describe('RemotionPreview', () => {
  beforeEach(() => {
    playerListeners.clear();
    seekToMock.mockClear();
    playMock.mockClear();
    pauseMock.mockClear();
    lastPlayerProps = undefined;
    playerRenderCount = 0;
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setClips([
      {
        id: 'clip-0',
        segment_index: 0,
        start_seconds: 0,
        end_seconds: 5,
      },
    ]);
  });

  it('默认不自动播放整体预览', () => {
    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    expect(lastPlayerProps?.autoPlay).not.toBe(true);
    expect(playMock).not.toHaveBeenCalled();
  });

  it('播放器本身使用固定预览尺寸', () => {
    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('remotion-preview-shell').getAttribute('style')).toContain(
      'width: 300px',
    );
    expect(screen.getByTestId('remotion-preview-shell').getAttribute('style')).toContain(
      'height: 533px',
    );
    expect(lastPlayerProps?.style).toEqual(
      expect.objectContaining({
        width: 300,
        height: 533,
        minWidth: 300,
        minHeight: 533,
        maxWidth: 300,
        maxHeight: 533,
      }),
    );
  });

  it('点击预览区域时切换播放和暂停', () => {
    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('remotion-preview-shell'));
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('remotion-preview-shell'));
    expect(pauseMock).toHaveBeenCalledTimes(1);
  });

  it('按空格时切换播放和暂停', () => {
    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(playMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(pauseMock).toHaveBeenCalledTimes(1);
  });

  it('焦点在可交互控件上时按空格不切换播放器', () => {
    render(
      <>
        <button type="button">素材按钮</button>
        <RemotionPreview
          segmentByIndex={new Map([[0, segment]])}
          playheadSeconds={0}
          onFrameChange={vi.fn()}
        />
      </>,
    );

    screen.getByRole('button', { name: '素材按钮' }).focus();
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });

    expect(playMock).not.toHaveBeenCalled();
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it('没有时间线片段时点击和空格都不触发播放', () => {
    useEditorStore.getState().resetEditor();

    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('remotion-preview-shell'));
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });

    expect(playMock).not.toHaveBeenCalled();
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it('将播放器 frameupdate 转换成秒并回传给时间线', () => {
    const onFrameChange = vi.fn();

    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={onFrameChange}
      />,
    );

    act(() => {
      playerListeners.get('frameupdate')?.({ detail: { frame: 60 } });
    });

    expect(onFrameChange).toHaveBeenCalledWith(2);
  });

  it('播放中只使用 frameupdate 同步时间线，忽略较旧的 timeupdate', () => {
    const onFrameChange = vi.fn();

    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={onFrameChange}
      />,
    );

    playerListeners.get('frameupdate')?.({ detail: { frame: 90 } });
    playerListeners.get('timeupdate')?.({ detail: { frame: 75 } });

    expect(onFrameChange).toHaveBeenCalledTimes(1);
    expect(onFrameChange).toHaveBeenCalledWith(3);
  });

  it('父组件跟随 playhead 更新时不重新渲染 Player，避免视频元素重建造成黑帧或回退', async () => {
    function PreviewHarness() {
      const playheadSeconds = useEditorStore((state) => state.playheadSeconds);
      const setPlayhead = useEditorStore((state) => state.setPlayhead);

      return (
        <RemotionPreview
          segmentByIndex={segmentMap}
          playheadSeconds={playheadSeconds}
          onFrameChange={setPlayhead}
        />
      );
    }

    render(
      <PreviewHarness />,
    );

    expect(playerRenderCount).toBe(1);

    await act(async () => {
      playerListeners.get('frameupdate')?.({ detail: { frame: 60 } });
      await Promise.resolve();
    });

    expect(useEditorStore.getState().playheadSeconds).toBe(2);
    expect(playerRenderCount).toBe(1);
  });

  it('用户拖动 playhead 时忽略播放器 frameupdate 回写', () => {
    const onFrameChange = vi.fn();

    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={onFrameChange}
        isUserSeeking
      />,
    );

    playerListeners.get('frameupdate')?.({ detail: { frame: 60 } });
    playerListeners.get('timeupdate')?.({ detail: { frame: 90 } });

    expect(onFrameChange).not.toHaveBeenCalled();
  });

  it('外部 playhead 改变时只跳转到对应帧一次', () => {
    const onFrameChange = vi.fn();
    const { rerender } = render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={onFrameChange}
      />,
    );

    seekToMock.mockClear();
    rerender(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={3}
        onFrameChange={onFrameChange}
      />,
    );

    expect(seekToMock).toHaveBeenCalledTimes(1);
    expect(seekToMock).toHaveBeenCalledWith(90);
  });

  it('最终 seek 提交才跳转预览，相同秒数的新提交也只跳转一次', () => {
    const onFrameChange = vi.fn();
    const { rerender } = render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={2}
        seekVersion={1}
        onFrameChange={onFrameChange}
      />,
    );

    seekToMock.mockClear();
    rerender(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={2}
        seekVersion={2}
        onFrameChange={onFrameChange}
      />,
    );
    playerListeners.get('frameupdate')?.({ detail: { frame: 60 } });

    expect(seekToMock).toHaveBeenCalledTimes(1);
    expect(seekToMock).toHaveBeenCalledWith(60);
    expect(onFrameChange).not.toHaveBeenCalled();
  });

  it('完整预览总时长会扣除 TransitionSeries 的转场重叠帧', () => {
    useEditorStore.getState().setClips([
      {
        id: 'clip-0',
        segment_index: 0,
        start_seconds: 0,
        end_seconds: 2,
      },
      {
        id: 'clip-1',
        segment_index: 0,
        start_seconds: 0,
        end_seconds: 4,
      },
    ]);
    useEditorStore.getState().setTransitions([
      {
        id: 'transition-clip-0-clip-1',
        from_clip_id: 'clip-0',
        to_clip_id: 'clip-1',
        type: 'fade',
        duration_frames: 12,
      },
    ]);

    render(
      <RemotionPreview
        segmentByIndex={new Map([[0, segment]])}
        playheadSeconds={0}
        onFrameChange={vi.fn()}
      />,
    );

    expect(lastPlayerProps?.durationInFrames).toBe(168);
  });
});
