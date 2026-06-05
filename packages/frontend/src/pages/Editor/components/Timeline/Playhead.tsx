import { useCallback, useRef } from 'react';
import styles from './Timeline.module.css';

interface PlayheadProps {
  seconds: number;
  pixelsPerSecond: number;
  totalDuration: number;
  onSeek: (seconds: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: (seconds: number) => void;
}

export function Playhead({
  seconds,
  pixelsPerSecond,
  totalDuration,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: PlayheadProps) {
  const draggingRef = useRef(false);
  const latestSecondsRef = useRef(seconds);

  const position = seconds * pixelsPerSecond;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      draggingRef.current = true;
      latestSecondsRef.current = seconds;
      onSeekStart?.();

      const parentEl = e.currentTarget.parentElement;
      if (!parentEl) return;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const rect = parentEl.getBoundingClientRect();
        const x = ev.clientX - rect.left + parentEl.scrollLeft;
        const newSeconds = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
        latestSecondsRef.current = newSeconds;
        onSeek(newSeconds);
      };

      const handleMouseUp = () => {
        draggingRef.current = false;
        onSeekEnd?.(latestSecondsRef.current);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [pixelsPerSecond, seconds, totalDuration, onSeek, onSeekStart, onSeekEnd],
  );

  return (
    <div className={styles.playhead} style={{ left: position }}>
      <div className={styles.playheadHead} />
      <div
        className={styles.playheadDragger}
        data-testid="playhead-dragger"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
