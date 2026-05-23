import type { ApiResponse } from '@aigc/shared-types';

export function unwrapResponse<T>(response: T | ApiResponse<T>): T {
  if (response && typeof response === 'object' && 'data' in response && 'code' in response) {
    return (response as ApiResponse<T>).data;
  }
  return response as T;
}

export function asArray<T>(value: T[] | unknown): T[] {
  return Array.isArray(value) ? value : [];
}
