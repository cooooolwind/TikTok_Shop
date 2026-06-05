import { useMemo } from 'react';
import styles from './Timeline.module.css';

interface TimelineRulerProps {
  totalDuration: number;
  pixelsPerSecond: number;
  innerWidth: number;
  onClick: (seconds: number) => void;
}

export function TimelineRuler({ totalDuration, pixelsPerSecond, innerWidth, onClick }: TimelineRulerProps) {
  const marks = useMemo(() => {
    const result: { position: number; label: string }[] = [];
    const step = pixelsPerSecond >= 100 ? 0.5 : pixelsPerSecond >= 50 ? 1 : 2;
    for (let t = 0; t <= totalDuration + 0.001; t += step) {
      result.push({ position: t * pixelsPerSecond, label: `${t.toFixed(step < 1 ? 1 : 0)}s` });
    }
    return result;
  }, [totalDuration, pixelsPerSecond]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (e.currentTarget.parentElement?.scrollLeft ?? 0);
    const seconds = Math.max(0, x / pixelsPerSecond);
    onClick(seconds);
  };

  return (
    <div className={styles.ruler} style={{ width: innerWidth }} onMouseDown={handleMouseDown}>
      {marks.map((m) => (
        <div key={m.position} style={{ left: m.position, position: 'absolute' }}>
          <div className={styles.rulerMark} />
          <span className={styles.rulerLabel}>{m.label}</span>
        </div>
      ))}
    </div>
  );
}
