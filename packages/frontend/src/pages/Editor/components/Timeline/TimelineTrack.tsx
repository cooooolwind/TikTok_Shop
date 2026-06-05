import { useMemo } from 'react';
import type {
  TimelineClip,
  TimelineTransition,
  TransitionType,
  VideoSegmentResult,
} from '@aigc/shared-types';
import { ClipBar } from './ClipBar';
import { TransitionMarker } from './TransitionMarker';
import styles from './Timeline.module.css';

const TRANSITION_DND_TYPE = 'application/timeline-transition';

interface TimelineTrackProps {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  segmentByIndex: Map<number, VideoSegmentResult>;
  pixelsPerSecond: number;
  selection: { type: 'clip' | 'transition'; id: string } | null;
  dropPosition: number | null;
  onSelectClip: (id: string) => void;
  onSelectTransition: (id: string) => void;
  onTrimClip: (id: string, field: 'start_seconds' | 'end_seconds', value: number) => void;
  onReorderClip: (fromIndex: number, toIndex: number) => void;
  onDropTransition: (fromClipId: string, toClipId: string, type: TransitionType) => void;
}

function transitionTypeFromDrop(e: React.DragEvent): TransitionType | undefined {
  try {
    const raw = e.dataTransfer.getData(TRANSITION_DND_TYPE);
    if (!raw) return undefined;
    return JSON.parse(raw)?.type;
  } catch {
    return undefined;
  }
}

export function TimelineTrack({
  clips,
  transitions,
  segmentByIndex,
  pixelsPerSecond,
  selection,
  dropPosition: _dropPosition,
  onSelectClip,
  onSelectTransition,
  onTrimClip,
  onReorderClip,
  onDropTransition,
}: TimelineTrackProps) {
  const gridLines = useMemo(() => {
    const totalDuration = clips.reduce(
      (sum, c) => sum + Math.max(c.end_seconds - c.start_seconds, 0),
      0,
    );
    const lines: { position: number; isMajor: boolean }[] = [];
    const step = pixelsPerSecond >= 100 ? 0.5 : 1;
    for (let t = 0; t <= totalDuration + 0.001; t += step) {
      lines.push({
        position: t * pixelsPerSecond,
        isMajor: Math.abs(t % 1) < 0.001,
      });
    }
    return lines;
  }, [clips, pixelsPerSecond]);

  let offset = 0;

  return (
    <div className={styles.track}>
      {gridLines.map((line) => (
        <div
          key={line.position}
          className={`${styles.gridLine} ${line.isMajor ? styles.gridLineMajor : ''}`}
          style={{ left: line.position }}
        />
      ))}
      {clips.map((clip, index) => {
        const segment = segmentByIndex.get(clip.segment_index);
        const duration = Math.max(clip.end_seconds - clip.start_seconds, 0);
        const width = duration * pixelsPerSecond;
        const left = offset;
        const nextClip = clips[index + 1];
        const transition = nextClip
          ? transitions.find(
              (item) => item.from_clip_id === clip.id && item.to_clip_id === nextClip.id,
            )
          : undefined;
        const elements: React.ReactNode[] = [];

        elements.push(
          <ClipBar
            key={clip.id}
            clip={clip}
            segment={segment}
            index={index}
            left={left}
            width={width}
            isSelected={selection?.type === 'clip' && selection.id === clip.id}
            pixelsPerSecond={pixelsPerSecond}
            onSelect={() => onSelectClip(clip.id)}
            onTrim={onTrimClip}
            onReorder={onReorderClip}
            totalClips={clips.length}
          />,
        );

        offset += width;

        if (nextClip) {
          elements.push(
            <div
              key={`drop-${clip.id}-${nextClip.id}`}
              className={styles.transitionDropZone}
              data-testid={`transition-drop-zone-${index}`}
              style={{ left: offset }}
              onDragOver={(event) => {
                if (transitionTypeFromDrop(event)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(event) => {
                const type = transitionTypeFromDrop(event);
                if (!type) return;
                event.preventDefault();
                event.stopPropagation();
                onDropTransition(clip.id, nextClip.id, type);
              }}
            >
              {transition ? (
                <TransitionMarker
                  transition={transition}
                  isSelected={selection?.type === 'transition' && selection.id === transition.id}
                  onSelect={() => onSelectTransition(transition.id)}
                />
              ) : (
                <span className={styles.transitionDropHint}>+</span>
              )}
            </div>,
          );
        }

        return elements;
      })}
    </div>
  );
}
