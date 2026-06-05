import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import type { TimelineClip, TimelineTransition, VideoSegmentResult } from '@aigc/shared-types';
import { useEditorStore } from '../../../../stores/useEditorStore';
import { BrowserTransitionComposition } from './BrowserTransitionComposition';
import styles from '../../VideoEditor.module.css';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const PLAYER_STYLE = {
  width: '100%',
  height: '100%',
};

interface RemotionPreviewProps {
  segmentByIndex: Map<number, VideoSegmentResult>;
  playheadSeconds?: number;
  seekVersion?: number;
  onFrameChange?: (seconds: number) => void;
  isUserSeeking?: boolean;
}

type FrameEvent = {
  detail?: {
    frame?: number;
  };
};

interface PreviewPlayerProps {
  playerRef: RefObject<PlayerRef>;
  inputProps: {
    clips: TimelineClip[];
    transitions: TimelineTransition[];
    segmentByIndex: Record<number, VideoSegmentResult>;
  };
  durationInFrames: number;
}

const PreviewPlayer = memo(function PreviewPlayer({
  playerRef,
  inputProps,
  durationInFrames,
}: PreviewPlayerProps) {
  return (
    <Player
      ref={playerRef}
      component={BrowserTransitionComposition}
      inputProps={inputProps}
      durationInFrames={Math.max(durationInFrames, 1)}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      style={PLAYER_STYLE}
      controls
      loop
    />
  );
});

function shouldIgnorePlaybackShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button' ||
    target.closest('button,a,input,textarea,select,[contenteditable="true"]') !== null
  );
}

export default function RemotionPreview({
  segmentByIndex,
  playheadSeconds = 0,
  seekVersion,
  onFrameChange,
  isUserSeeking = false,
}: RemotionPreviewProps) {
  const clips = useEditorStore((state) => state.clips);
  const transitions = useEditorStore((state) => state.transitions);
  const playerRef = useRef<PlayerRef>(null);
  const playerDrivenUpdateRef = useRef(false);
  const suppressFrameEventsRef = useRef(0);
  const lastSeekVersionRef = useRef<number | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const segmentRecord = useMemo(() => {
    const record: Record<number, VideoSegmentResult> = {};
    segmentByIndex.forEach((v, k) => {
      record[k] = v;
    });
    return record;
  }, [segmentByIndex]);

  const playerInputProps = useMemo(
    () => ({
      clips,
      transitions,
      segmentByIndex: segmentRecord,
    }),
    [clips, segmentRecord, transitions],
  );

  const durationInFrames = useMemo(
    () => {
      const clipDurationFrames = clips.reduce(
        (sum, c) => sum + Math.max(Math.round((c.end_seconds - c.start_seconds) * FPS), 1),
        0,
      );
      const transitionDurationFrames = transitions.reduce((sum, transition) => {
        const fromIndex = clips.findIndex((clip) => clip.id === transition.from_clip_id);
        const isValidAdjacent =
          fromIndex >= 0 && clips[fromIndex + 1]?.id === transition.to_clip_id;
        if (!isValidAdjacent || transition.type === 'none') return sum;
        return sum + Math.min(Math.max(Math.round(transition.duration_frames ?? 12), 6), 30);
      }, 0);

      return Math.max(clipDurationFrames - transitionDurationFrames, 1);
    },
    [clips, transitions],
  );
  const hasPlayableClips = clips.length > 0;

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player || !hasPlayableClips) return;

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }

    void player.play();
    setIsPlaying(true);
  }, [hasPlayableClips, isPlaying]);

  useEffect(() => {
    if (hasPlayableClips) return;
    if (isPlaying) {
      playerRef.current?.pause();
    }
    setIsPlaying(false);
  }, [hasPlayableClips, isPlaying]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.code !== 'Space') return;
      if (
        shouldIgnorePlaybackShortcut(event.target) ||
        shouldIgnorePlaybackShortcut(document.activeElement)
      ) {
        return;
      }
      if (!hasPlayableClips) return;

      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasPlayableClips, togglePlayback]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onFrameChange) return;

    const handleFrame = (event: FrameEvent) => {
      if (isUserSeeking) return;
      if (suppressFrameEventsRef.current > 0) {
        suppressFrameEventsRef.current -= 1;
        return;
      }
      const frame = event.detail?.frame ?? player.getCurrentFrame();
      playerDrivenUpdateRef.current = true;
      onFrameChange(frame / FPS);
    };

    player.addEventListener('frameupdate', handleFrame);

    return () => {
      player.removeEventListener('frameupdate', handleFrame);
    };
  }, [isUserSeeking, onFrameChange]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || isUserSeeking) return;

    if (seekVersion !== undefined) {
      if (lastSeekVersionRef.current === seekVersion) return;
      lastSeekVersionRef.current = seekVersion;
      suppressFrameEventsRef.current = 2;
      player.seekTo(Math.max(0, Math.round(playheadSeconds * FPS)));
      return;
    }

    if (playerDrivenUpdateRef.current) {
      playerDrivenUpdateRef.current = false;
      return;
    }

    player.seekTo(Math.max(0, Math.round(playheadSeconds * FPS)));
  }, [isUserSeeking, playheadSeconds, seekVersion]);

  if (loadError) {
    return (
      <div className={styles.remotionPreviewError}>
        <span>整体预览加载失败</span>
        <small>{loadError}</small>
        <button onClick={() => setLoadError(null)}>重试</button>
      </div>
    );
  }

  return (
    <div
      className={styles.remotionPreviewShell}
      data-testid="remotion-preview-shell"
      onClick={(event) => {
        if (shouldIgnorePlaybackShortcut(event.target)) return;
        togglePlayback();
      }}
    >
      <PreviewPlayer
        playerRef={playerRef}
        inputProps={playerInputProps}
        durationInFrames={durationInFrames}
      />
    </div>
  );
}
