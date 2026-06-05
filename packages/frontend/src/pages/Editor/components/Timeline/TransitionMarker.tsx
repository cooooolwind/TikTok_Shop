import type { TimelineTransition } from '@aigc/shared-types';
import styles from './Timeline.module.css';

const TRANSITION_LABEL: Record<string, string> = {
  none: '无',
  fade: '淡入',
  slide: '滑动',
  wipe: '擦除',
  zoom_blur: '缩放',
};

interface TransitionMarkerProps {
  transition: TimelineTransition;
  isSelected: boolean;
  onSelect: () => void;
}

export function TransitionMarker({ transition, isSelected, onSelect }: TransitionMarkerProps) {
  const label = TRANSITION_LABEL[transition.type] ?? transition.type;

  const markerClass = [styles.transitionMarker, isSelected ? styles.transitionMarkerSelected : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={markerClass} onClick={onSelect}>
      <span className={styles.transitionLabel}>{label}</span>
    </button>
  );
}
