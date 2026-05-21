import type { PaginationQuery } from './common';

// ===== BGM =====

export interface BGM {
  id: string;
  name: string;
  style: string;
  duration: number;
  preview_url: string;
  bpm: number;
}

export interface BGMListQuery extends PaginationQuery {
  style?: 'upbeat' | 'calm' | 'dramatic' | 'funny';
  duration_min?: number;
  duration_max?: number;
}
