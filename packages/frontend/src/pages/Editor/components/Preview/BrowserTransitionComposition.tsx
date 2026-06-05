import { AbsoluteFill, Video, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { zoomBlur } from '@remotion/transitions/zoom-blur';
import type { TimelineClip, TimelineTransition, TransitionType, VideoSegmentResult } from '@aigc/shared-types';
import type { TransitionPresentation } from '@remotion/transitions';

interface BrowserCompositionProps {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  segmentByIndex: Record<number, VideoSegmentResult>;
}

export function BrowserTransitionComposition({
  clips,
  transitions,
  segmentByIndex,
}: BrowserCompositionProps) {
  const { fps } = useVideoConfig();

  const children = clips.flatMap((clip, index) => {
    const segment = segmentByIndex[clip.segment_index];
    if (!segment) return [];
    
    const startFrame = Math.max(0, Math.round(clip.start_seconds * fps));
    const endFrame = Math.max(startFrame + 1, Math.round(clip.end_seconds * fps));
    const durationInFrames = Math.max(endFrame - startFrame, 1);
    const nextClip = clips[index + 1];
    const transition = nextClip
      ? transitions.find(
          (item) => item.from_clip_id === clip.id && item.to_clip_id === nextClip.id,
        )
      : undefined;

    const sequence = (
      <TransitionSeries.Sequence
        key={`segment-${clip.segment_index}-${index}`}
        durationInFrames={durationInFrames}
      >
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
          <Video
            src={segment.video_url}
            trimBefore={startFrame}
            trimAfter={endFrame}
            pauseWhenBuffering
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
    );

    if (!transition || transition.type === 'none' || index === clips.length - 1) {
      return [sequence];
    }

    return [
      sequence,
      <TransitionSeries.Transition
        key={`transition-${clip.segment_index}`}
        timing={linearTiming({
          durationInFrames: Math.min(
            Math.max(Math.round(transition.duration_frames ?? 12), 6),
            30,
          ),
        })}
        presentation={
          presentationFor(transition.type) as TransitionPresentation<Record<string, unknown>>
        }
      />,
    ];
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
}

function presentationFor(type: TransitionType) {
  if (type === 'slide') return slide();
  if (type === 'wipe') return wipe();
  if (type === 'zoom_blur') return zoomBlur({});
  return fade();
}
