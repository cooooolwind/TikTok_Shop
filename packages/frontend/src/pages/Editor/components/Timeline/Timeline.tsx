import { useCallback, useMemo, useRef, useState } from 'react';
import { Slider } from 'antd';
import type { TransitionType, VideoSegmentResult } from '@aigc/shared-types';
import { useEditorStore } from '../../../../stores/useEditorStore';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { Playhead } from './Playhead';
import styles from './Timeline.module.css';

const TRANSITION_DND_TYPE = 'application/timeline-transition';

interface TimelineProps {
  segmentByIndex: Map<number, VideoSegmentResult>;
  onDropSegment?: (segmentIndex: number, afterIndex?: number) => void;
  onInvalidTransitionDrop?: () => void;
  onSeekCommit?: (seconds: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: (seconds: number) => void;
}

function readTransitionDrop(e: React.DragEvent): TransitionType | undefined {
  try {
    const raw = e.dataTransfer.getData(TRANSITION_DND_TYPE);
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    return data?.type;
  } catch {
    return undefined;
  }
}

export function Timeline({
  segmentByIndex,
  onDropSegment,
  onInvalidTransitionDrop,
  onSeekCommit,
  onSeekStart,
  onSeekEnd,
}: TimelineProps) {
  const {
    clips,
    transitions,
    pixelsPerSecond,
    playheadSeconds,
    selection,
    setPlayhead,
    setZoom,
    setSelection,
    trimClip,
    reorderClip,
    upsertTransitionBetween,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draftPlayheadSeconds, setDraftPlayheadSeconds] = useState<number | null>(null);

  const totalDuration = useMemo(
    () => clips.reduce((sum, c) => sum + Math.max(c.end_seconds - c.start_seconds, 0), 0),
    [clips],
  );

  const innerWidth = Math.max(totalDuration * pixelsPerSecond + 40, 400);
  const visiblePlayheadSeconds = draftPlayheadSeconds ?? playheadSeconds;

  const handleRulerClick = useCallback(
    (seconds: number) => {
      if (onSeekCommit) {
        onSeekCommit(seconds);
      } else {
        setPlayhead(seconds);
      }
    },
    [onSeekCommit, setPlayhead],
  );

  const calculateDropIndex = useCallback(
    (clientX: number): number | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left + container.scrollLeft;
      let offset = 0;
      for (let i = 0; i < clips.length; i++) {
        const dur = Math.max(clips[i].end_seconds - clips[i].start_seconds, 0);
        const mid = offset + dur * pixelsPerSecond * 0.5;
        if (x < mid) {
          setDropPosition(offset);
          return i > 0 ? i - 1 : -1;
        }
        offset += dur * pixelsPerSecond;
      }
      setDropPosition(offset);
      return clips.length - 1;
    },
    [clips, pixelsPerSecond],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
      if (!readTransitionDrop(e)) {
        calculateDropIndex(e.clientX);
      }
    },
    [calculateDropIndex],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setDropPosition(null);

      if (readTransitionDrop(e)) {
        onInvalidTransitionDrop?.();
        return;
      }

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/timeline-segment'));
        if (data?.segmentIndex !== undefined && onDropSegment) {
          let afterIndex = -1;
          if (clips.length > 0) {
            afterIndex = calculateDropIndex(e.clientX) ?? clips.length - 1;
          }
          onDropSegment(data.segmentIndex, afterIndex);
        }
      } catch {
        // Ignore invalid drop data.
      }
    },
    [clips.length, calculateDropIndex, onDropSegment, onInvalidTransitionDrop],
  );

  const handleDropTransition = useCallback(
    (fromClipId: string, toClipId: string, type: TransitionType) => {
      upsertTransitionBetween(fromClipId, toClipId, type);
    },
    [upsertTransitionBetween],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(pixelsPerSecond - e.deltaY * 0.3);
      }
    },
    [pixelsPerSecond, setZoom],
  );

  const formatTimecode = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  if (clips.length === 0) {
    return (
      <div
        className={styles.timelineOuter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={`${styles.emptyTimeline} ${isDragOver ? styles.dropActive : ''}`}>
          {isDragOver ? '释放以加入时间线' : '时间线为空，请从左侧素材片段拖入或点击加入'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={styles.timelineOuter}
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onWheel={handleWheel}
      >
        <div className={styles.timelineInner} style={{ width: innerWidth }} data-testid="timeline-inner">
          <TimelineRuler
            totalDuration={totalDuration}
            pixelsPerSecond={pixelsPerSecond}
            innerWidth={innerWidth}
            onClick={handleRulerClick}
          />
          <TimelineTrack
            clips={clips}
            transitions={transitions}
            segmentByIndex={segmentByIndex}
            pixelsPerSecond={pixelsPerSecond}
            selection={
              selection?.type === 'clip' || selection?.type === 'transition' ? selection : null
            }
            dropPosition={dropPosition}
            onSelectClip={(id) => setSelection({ type: 'clip', id })}
            onSelectTransition={(id) => setSelection({ type: 'transition', id })}
            onTrimClip={trimClip}
            onReorderClip={reorderClip}
            onDropTransition={handleDropTransition}
          />
          {dropPosition !== null && (
            <div className={styles.dropIndicator} style={{ left: dropPosition }} />
          )}
          <Playhead
            seconds={visiblePlayheadSeconds}
            pixelsPerSecond={pixelsPerSecond}
            totalDuration={totalDuration}
            onSeek={setDraftPlayheadSeconds}
            onSeekStart={() => {
              setDraftPlayheadSeconds(playheadSeconds);
              onSeekStart?.();
            }}
            onSeekEnd={(seconds) => {
              setDraftPlayheadSeconds(null);
              if (onSeekCommit) {
                onSeekCommit(seconds);
              } else {
                setPlayhead(seconds);
              }
              onSeekEnd?.(seconds);
            }}
          />
        </div>
      </div>
      <div className={styles.zoomBar}>
        <span className={styles.zoomLabel}>缩放</span>
        <Slider
          min={30}
          max={250}
          step={10}
          value={pixelsPerSecond}
          onChange={setZoom}
          style={{ width: 160, margin: 0 }}
          tooltip={{ formatter: (v) => `${v} px/s` }}
        />
        <span className={styles.timeCode}>{formatTimecode(visiblePlayheadSeconds)}</span>
      </div>
    </div>
  );
}
