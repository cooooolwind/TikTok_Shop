import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration } from './format';

describe('formatBytes', () => {
  it('should return 0 B for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes less than 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('should format KB correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('should format decimal KB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('should format MB correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('should format GB correctly', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('formatDuration', () => {
  it('should format seconds to mm:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('should handle 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should pad single-digit seconds', () => {
    expect(formatDuration(70)).toBe('1:10');
  });

  it('should handle large values', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });
});
