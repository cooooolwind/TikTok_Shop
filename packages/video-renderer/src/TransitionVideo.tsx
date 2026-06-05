import { AbsoluteFill, OffthreadVideo, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { zoomBlur } from '@remotion/transitions/zoom-blur';
import type { RenderInput, TransitionConfig } from './types.js';
import type { TransitionPresentation } from '@remotion/transitions';

interface TransitionVideoProps {
  input: RenderInput;
}

export function TransitionVideo({ input }: TransitionVideoProps) {
  const { fps } = useVideoConfig();
  const children = input.segments.flatMap((segment, index) => {
    const trimStart = Math.max(segment.trim_start_seconds ?? 0, 0);
    const trimEnd = Math.min(segment.trim_end_seconds ?? segment.duration, segment.duration);
    const duration = Math.max(trimEnd - trimStart, 0.1);
    const transition = normalizeTransition(input.transitions?.[index] ?? input.transition);
    const sequence = (
      <TransitionSeries.Sequence key={`segment-${segment.index}-${index}`} durationInFrames={toFrames(duration, fps)}>
        <SegmentVideo src={segment.video_url} startFrom={toFrames(trimStart, fps)} />
      </TransitionSeries.Sequence>
    );

    if (transition.type === 'none' || index === input.segments.length - 1) return [sequence];

    return [
      sequence,
      <TransitionSeries.Transition
        key={`transition-${segment.index}`}
        timing={linearTiming({ durationInFrames: transition.duration_frames })}
        presentation={presentationFor(transition) as TransitionPresentation<Record<string, unknown>>}
      />,
    ];
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
}

function SegmentVideo({ src, startFrom }: { src: string; startFrom: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </AbsoluteFill>
  );
}

function presentationFor(transition: Required<TransitionConfig>) {
  if (transition.type === 'slide') return slide();
  if (transition.type === 'wipe') return wipe();
  if (transition.type === 'zoom_blur') return zoomBlur({});
  return fade();
}

function normalizeTransition(transition?: TransitionConfig): Required<TransitionConfig> {
  return {
    type: transition?.type ?? 'fade',
    duration_frames: Math.min(Math.max(Math.round(transition?.duration_frames ?? 12), 6), 30),
  };
}

function toFrames(durationSeconds: number, fps: number) {
  return Math.max(Math.round(durationSeconds * fps), 1);
}
