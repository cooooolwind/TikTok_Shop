import { useCallback, useRef, useState } from 'react';
import type { TimelineClip, VideoSegmentResult } from '@aigc/shared-types';
import styles from './Timeline.module.css';

interface ClipBarProps {
  clip: TimelineClip;
  segment: VideoSegmentResult | undefined;
  index: number;
  left: number;
  width: number;
  isSelected: boolean;
  pixelsPerSecond: number;
  onSelect: () => void;
  onTrim: (id: string, field: 'start_seconds' | 'end_seconds', value: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  totalClips: number;
}

export function ClipBar({
  clip,
  segment,
  index,
  left,
  width,
  isSelected,
  pixelsPerSecond,
  onSelect,
  onTrim,
  onReorder,
  totalClips,
}: ClipBarProps) {
  const dragRef = useRef<{
    type: 'trim-start' | 'trim-end' | 'reorder' | null;
    startX: number;
    originalStart: number;
    originalEnd: number;
    originalIndex: number;
  }>({ type: null, startX: 0, originalStart: 0, originalEnd: 0, originalIndex: 0 });

  const [isDragging, setIsDragging] = useState(false);

  const duration = Math.max(clip.end_seconds - clip.start_seconds, 0);
  const segmentNumber = (segment?.index ?? clip.segment_index) + 1;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dragType: 'trim-start' | 'trim-end' | 'reorder') => {
      e.stopPropagation();
      e.preventDefault();

      dragRef.current = {
        type: dragType,
        startX: e.clientX,
        originalStart: clip.start_seconds,
        originalEnd: clip.end_seconds,
        originalIndex: index,
      };

      if (dragType === 'reorder') {
        setIsDragging(true);
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d.type) return;

        const deltaX = ev.clientX - d.startX;
        const deltaSeconds = deltaX / pixelsPerSecond;

        if (d.type === 'trim-start') {
          const newStart = Math.max(0, d.originalStart + deltaSeconds);
          const maxStart = clip.end_seconds - 0.1;
          onTrim(clip.id, 'start_seconds', Math.min(newStart, Math.max(0, maxStart)));
        } else if (d.type === 'trim-end') {
          const segmentDuration = segment?.duration ?? clip.end_seconds;
          const newEnd = Math.min(segmentDuration, d.originalEnd + deltaSeconds);
          const minEnd = clip.start_seconds + 0.1;
          onTrim(clip.id, 'end_seconds', Math.max(newEnd, minEnd));
        } else if (d.type === 'reorder') {
          const moveSteps = Math.round(deltaX / (Math.max(width, 120) * 0.5));
          const targetIndex = Math.max(0, Math.min(totalClips - 1, d.originalIndex + moveSteps));
          if (targetIndex !== d.originalIndex && targetIndex !== index) {
            onReorder(d.originalIndex, targetIndex);
            d.originalIndex = targetIndex;
            d.startX = ev.clientX;
          }
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clip, segment, index, width, pixelsPerSecond, onTrim, onReorder, totalClips],
  );

  const clipBarClass = [
    styles.clipBar,
    isSelected ? styles.clipBarSelected : '',
    isDragging ? styles.clipBarDragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  const minWidth = Math.max(width, 80);

  return (
    <div
      className={clipBarClass}
      style={{ left, width: minWidth }}
      onClick={onSelect}
      onMouseDown={(e) => handleMouseDown(e, 'reorder')}
    >
      <div
        className={`${styles.trimHandle} ${styles.trimHandleLeft}`}
        onMouseDown={(e) => handleMouseDown(e, 'trim-start')}
      />
      <div
        className={`${styles.trimHandle} ${styles.trimHandleRight}`}
        onMouseDown={(e) => handleMouseDown(e, 'trim-end')}
      />
      <div className={styles.clipThumbStrip}>
        {segment?.thumbnail_url ? (
          <img src={segment.thumbnail_url} alt={`时间线第 ${segmentNumber} 段缩略图`} />
        ) : (
          <span aria-label={`时间线第 ${segmentNumber} 段占位缩略图`}>{segmentNumber}</span>
        )}
      </div>
      <div className={styles.clipTextLayer}>
        <span className={styles.clipLabel}>片段 {segmentNumber}</span>
        <span className={styles.clipTime}>
          {clip.start_seconds.toFixed(1)}s - {clip.end_seconds.toFixed(1)}s (
          {duration.toFixed(1)}s)
        </span>
      </div>
    </div>
  );
}
