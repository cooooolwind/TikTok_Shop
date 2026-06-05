import { create } from 'zustand';
import type { TimelineClip, TimelineTransition, TransitionType } from '@aigc/shared-types';

type Selection = { type: 'clip'; id: string } | { type: 'transition'; id: string } | null;

export interface EditorState {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  playheadSeconds: number;
  pixelsPerSecond: number;
  isPlaying: boolean;
  previewMode: 'basic' | 'remotion';
  selection: Selection;

  setClips: (clips: TimelineClip[]) => void;
  setTransitions: (transitions: TimelineTransition[]) => void;
  setPlayhead: (seconds: number) => void;
  setZoom: (pps: number) => void;
  togglePlay: () => void;
  setPreviewMode: (mode: 'basic' | 'remotion') => void;
  setSelection: (selection: Selection) => void;

  addClip: (clip: TimelineClip, afterIndex?: number) => void;
  removeClip: (id: string) => void;
  moveClip: (id: string, direction: -1 | 1) => void;
  reorderClip: (fromIndex: number, toIndex: number) => void;
  trimClip: (id: string, field: 'start_seconds' | 'end_seconds', value: number) => void;
  updateTransition: (
    id: string,
    field: 'type' | 'duration_frames',
    value: TransitionType | number,
  ) => void;
  upsertTransitionBetween: (
    fromClipId: string,
    toClipId: string,
    type: TransitionType,
  ) => void;
  removeTransition: (id: string) => void;

  resetEditor: () => void;
}

const DEFAULT_PIXELS_PER_SECOND = 80;
const DEFAULT_TRANSITION_FRAMES = 12;

const initialState = {
  clips: [],
  transitions: [],
  playheadSeconds: 0,
  pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  isPlaying: false,
  previewMode: 'remotion' as const,
  selection: null as Selection,
};

function adjacentPairKeys(clips: TimelineClip[]) {
  return new Set(
    clips
      .slice(0, -1)
      .map((clip, index) => `${clip.id}->${clips[index + 1].id}`),
  );
}

function keepValidTransitions(
  clips: TimelineClip[],
  transitions: TimelineTransition[],
): TimelineTransition[] {
  const validPairs = adjacentPairKeys(clips);
  return transitions.filter((transition) =>
    validPairs.has(`${transition.from_clip_id}->${transition.to_clip_id}`),
  );
}

function makeTransitionId(fromClipId: string, toClipId: string) {
  return `transition-${fromClipId}-${toClipId}`;
}

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  setClips: (clips) =>
    set((state) => ({
      clips,
      transitions: keepValidTransitions(clips, state.transitions),
    })),

  setTransitions: (transitions) => set({ transitions }),

  setPlayhead: (seconds) => set({ playheadSeconds: Math.max(0, seconds) }),

  setZoom: (pps) => set({ pixelsPerSecond: Math.max(20, Math.min(300, pps)) }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  setSelection: (selection) => set({ selection }),

  addClip: (clip, afterIndex) =>
    set((state) => {
      const nextClips = [...state.clips];
      if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < nextClips.length) {
        nextClips.splice(afterIndex + 1, 0, clip);
      } else {
        nextClips.push(clip);
      }
      return {
        clips: nextClips,
        transitions: keepValidTransitions(nextClips, state.transitions),
        selection: { type: 'clip', id: clip.id } as Selection,
      };
    }),

  removeClip: (id) =>
    set((state) => {
      const nextClips = state.clips.filter((clip) => clip.id !== id);
      const nextTransitions = keepValidTransitions(nextClips, state.transitions);
      const nextSelection =
        state.selection?.type === 'clip' && state.selection.id === id
          ? nextClips[0]
            ? ({ type: 'clip', id: nextClips[0].id } as Selection)
            : null
          : state.selection?.type === 'transition' &&
              !nextTransitions.some((transition) => transition.id === state.selection?.id)
            ? null
            : state.selection;

      return {
        clips: nextClips,
        transitions: nextTransitions,
        selection: nextSelection,
      };
    }),

  moveClip: (id, direction) =>
    set((state) => {
      const index = state.clips.findIndex((clip) => clip.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= state.clips.length) return state;
      const nextClips = [...state.clips];
      [nextClips[index], nextClips[nextIndex]] = [nextClips[nextIndex], nextClips[index]];
      return {
        clips: nextClips,
        transitions: keepValidTransitions(nextClips, state.transitions),
      };
    }),

  reorderClip: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return state;
      const nextClips = [...state.clips];
      const [moved] = nextClips.splice(fromIndex, 1);
      nextClips.splice(toIndex, 0, moved);
      return {
        clips: nextClips,
        transitions: keepValidTransitions(nextClips, state.transitions),
      };
    }),

  trimClip: (id, field, value) =>
    set((state) => ({
      clips: state.clips.map((clip) => (clip.id === id ? { ...clip, [field]: value } : clip)),
    })),

  updateTransition: (id, field, value) =>
    set((state) => ({
      transitions:
        field === 'type' && value === 'none'
          ? state.transitions.filter((transition) => transition.id !== id)
          : state.transitions.map((transition) =>
              transition.id === id
                ? {
                    ...transition,
                    [field]: field === 'duration_frames' ? Number(value) : value,
                  }
                : transition,
            ),
      selection:
        field === 'type' && value === 'none' && state.selection?.type === 'transition'
          ? null
          : state.selection,
    })),

  upsertTransitionBetween: (fromClipId, toClipId, type) =>
    set((state) => {
      const isAdjacent = state.clips.some(
        (clip, index) =>
          clip.id === fromClipId && state.clips[index + 1]?.id === toClipId,
      );
      if (!isAdjacent) return state;

      const existing = state.transitions.find(
        (transition) =>
          transition.from_clip_id === fromClipId && transition.to_clip_id === toClipId,
      );

      if (type === 'none') {
        const nextTransitions = state.transitions.filter(
          (transition) =>
            !(transition.from_clip_id === fromClipId && transition.to_clip_id === toClipId),
        );
        return {
          transitions: nextTransitions,
          selection:
            existing && state.selection?.type === 'transition' && state.selection.id === existing.id
              ? null
              : state.selection,
        };
      }

      const transition: TimelineTransition = {
        id: existing?.id ?? makeTransitionId(fromClipId, toClipId),
        from_clip_id: fromClipId,
        to_clip_id: toClipId,
        type,
        duration_frames: existing?.duration_frames ?? DEFAULT_TRANSITION_FRAMES,
      };

      return {
        transitions: existing
          ? state.transitions.map((item) => (item.id === existing.id ? transition : item))
          : [...state.transitions, transition],
        selection: { type: 'transition', id: transition.id } as Selection,
      };
    }),

  removeTransition: (id) =>
    set((state) => ({
      transitions: state.transitions.filter((transition) => transition.id !== id),
      selection:
        state.selection?.type === 'transition' && state.selection.id === id
          ? null
          : state.selection,
    })),

  resetEditor: () => set({ ...initialState }),
}));
