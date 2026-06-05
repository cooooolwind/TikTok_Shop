import { Composition } from 'remotion';
import { TransitionVideo } from './TransitionVideo.js';
import type { RenderInput } from './types.js';
import type { ComponentType } from 'react';

const defaultInput: RenderInput = {
  task_id: 'preview',
  resolution: '1080x1920',
  fps: 30,
  transition: { type: 'fade', duration_frames: 12 },
  segments: [
    {
      index: 0,
      video_url: '',
      duration: 4,
      resolution: '1080x1920',
      aspect_ratio: '9:16',
    },
  ],
};

export function RemotionRoot() {
  return (
    <Composition
      id="TransitionVideo"
      component={TransitionVideo as unknown as ComponentType<Record<string, unknown>>}
      durationInFrames={durationInFrames(defaultInput)}
      fps={defaultInput.fps}
      width={resolutionParts(defaultInput.resolution).width}
      height={resolutionParts(defaultInput.resolution).height}
      defaultProps={{ input: defaultInput }}
      calculateMetadata={({ props }) => {
        const input = props.input as RenderInput;
        const resolution = resolutionParts(input.resolution);
        return {
          durationInFrames: durationInFrames(input),
          fps: input.fps,
          width: resolution.width,
          height: resolution.height,
        };
      }}
    />
  );
}

function durationInFrames(input: RenderInput) {
  const rawDuration = input.segments.reduce((sum, segment) => sum + Math.round(segment.duration * input.fps), 0);
  return Math.max(rawDuration, 1);
}

function resolutionParts(resolution: string) {
  const [width, height] = resolution.split('x').map((part) => Number.parseInt(part, 10));
  return {
    width: Number.isFinite(width) ? width : 1080,
    height: Number.isFinite(height) ? height : 1920,
  };
}
