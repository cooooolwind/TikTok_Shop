// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineClip, TimelineTransition, VideoSegmentResult } from '@aigc/shared-types';
import { BrowserTransitionComposition } from './BrowserTransitionComposition';

vi.mock('remotion', () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Video: (props: {
    src: string;
    trimBefore?: number;
    trimAfter?: number;
    pauseWhenBuffering?: boolean;
  }) => (
    <div
      data-testid="preview-video"
      data-src={props.src}
      data-trim-before={props.trimBefore}
      data-trim-after={props.trimAfter}
      data-pause-when-buffering={String(props.pauseWhenBuffering)}
    />
  ),
  useCurrentFrame: () => 45,
  useVideoConfig: () => ({ fps: 30 }),
}));

vi.mock('@remotion/transitions', () => {
  const Series = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Series.Sequence = ({ children, durationInFrames }: {
    children?: React.ReactNode;
    durationInFrames: number;
  }) => (
    <div data-testid="preview-sequence" data-duration={durationInFrames}>
      {children}
    </div>
  );
  Series.Transition = ({ presentation }: { presentation: { name: string } }) => (
    <div data-testid="preview-transition" data-presentation={presentation.name} />
  );

  return {
    TransitionSeries: Series,
    linearTiming: (config: unknown) => config,
  };
});

vi.mock('@remotion/transitions/fade', () => ({ fade: () => ({ name: 'fade' }) }));
vi.mock('@remotion/transitions/slide', () => ({ slide: () => ({ name: 'slide' }) }));
vi.mock('@remotion/transitions/wipe', () => ({ wipe: () => ({ name: 'wipe' }) }));
vi.mock('@remotion/transitions/zoom-blur', () => ({ zoomBlur: () => ({ name: 'zoom_blur' }) }));

const segmentByIndex: Record<number, VideoSegmentResult> = {
  0: {
    index: 0,
    video_url: 'https://example.com/segment-1.mp4',
    thumbnail_url: '',
    duration: 5,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    scene_orders: [1],
  },
  1: {
    index: 1,
    video_url: 'https://example.com/segment-2.mp4',
    thumbnail_url: '',
    duration: 5,
    resolution: '1080x1920',
    aspect_ratio: '9:16',
    scene_orders: [2],
  },
};

describe('BrowserTransitionComposition', () => {
  it('按素材源视频 in/out 裁剪，并按相邻 clip id 匹配转场', () => {
    const clips: TimelineClip[] = [
      { id: 'clip-a', segment_index: 0, start_seconds: 1, end_seconds: 3 },
      { id: 'clip-b', segment_index: 1, start_seconds: 0, end_seconds: 4 },
    ];
    const transitions: TimelineTransition[] = [
      {
        id: 'wrong-index-transition',
        from_clip_id: 'clip-x',
        to_clip_id: 'clip-y',
        type: 'fade',
        duration_frames: 12,
      },
      {
        id: 'real-transition',
        from_clip_id: 'clip-a',
        to_clip_id: 'clip-b',
        type: 'slide',
        duration_frames: 12,
      },
    ];

    render(
      <BrowserTransitionComposition
        clips={clips}
        transitions={transitions}
        segmentByIndex={segmentByIndex}
      />,
    );

    const videos = screen.getAllByTestId('preview-video');
    expect(videos[0].getAttribute('data-trim-before')).toBe('30');
    expect(videos[0].getAttribute('data-trim-after')).toBe('90');
    expect(videos[0].getAttribute('data-pause-when-buffering')).toBe('true');
    expect(screen.getAllByTestId('preview-sequence')[0].getAttribute('data-duration')).toBe('60');
    expect(screen.getByTestId('preview-transition').getAttribute('data-presentation')).toBe(
      'slide',
    );
  });

  it('renders the active subtitle cue at the current preview time', () => {
    const clips: TimelineClip[] = [
      { id: 'clip-a', segment_index: 0, start_seconds: 0, end_seconds: 3 },
    ];

    render(
      <BrowserTransitionComposition
        clips={clips}
        transitions={[]}
        subtitles={[
          { id: 'cue-before', start_seconds: 0, end_seconds: 1, text: 'Before' },
          { id: 'cue-active', start_seconds: 1, end_seconds: 2, text: 'Active subtitle' },
        ]}
        segmentByIndex={segmentByIndex}
      />,
    );

    expect(screen.getByText('Active subtitle')).toBeTruthy();
    expect(screen.queryByText('Before')).toBeNull();
  });
});
