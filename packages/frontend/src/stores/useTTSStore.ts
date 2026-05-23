import { create } from 'zustand';
import type { TTSState } from '../types';
import { ttsApi } from '../services/tts.api';
import { useUIStore } from './useAppStore';
import { asArray } from '../services/response';

export const useTTSStore = create<TTSState>((set) => ({
  voices: [],
  loading: false,
  previewing: false,
  previewAudioUrl: null,

  fetchVoices: async () => {
    set({ loading: true });
    try {
      const voices = await ttsApi.voices();
      set({ voices: asArray(voices), loading: false });
    } catch {
      set({ loading: false });
      useUIStore.getState().pushNotification({ type: 'error', title: '加载音色列表失败' });
    }
  },

  preview: async (text, voiceId, speed) => {
    set({ previewing: true });
    try {
      const result = await ttsApi.preview({ text, voice_id: voiceId, speed });
      set({ previewing: false, previewAudioUrl: result.audio_url });
      return result;
    } catch {
      set({ previewing: false });
      useUIStore.getState().pushNotification({ type: 'error', title: 'TTS 试听失败' });
      throw new Error('tts preview failed');
    }
  },

  clearPreview: () => set({ previewAudioUrl: null }),
}));
