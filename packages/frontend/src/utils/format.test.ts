import { describe, it, expect } from 'vitest';
import { formatBeijingDateTime, formatBytes, formatDuration, formatGenerationTaskDisplayId, formatScriptDisplayId } from './format';

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

describe('formatBeijingDateTime', () => {
  it('formats ISO time in Beijing timezone', () => {
    expect(formatBeijingDateTime('2026-05-25T03:37:00.000Z')).toBe('2026/5/25 11:37:00');
  });

  it('does not add eight hours twice when the input already has a Beijing offset', () => {
    expect(formatBeijingDateTime('2026-05-25T11:37:00+08:00')).toBe('2026/5/25 11:37:00');
  });
});

describe('formatScriptDisplayId', () => {
  it('uses JB plus Beijing date and current time', () => {
    expect(formatScriptDisplayId('2026-05-25T03:37:00.000Z')).toBe('JB20260525-1137');
  });

  it('uses the Beijing wall clock from offset-aware input', () => {
    expect(formatScriptDisplayId('2026-05-25T11:37:00+08:00')).toBe('JB20260525-1137');
  });
});

describe('formatGenerationTaskDisplayId', () => {
  it('uses backend display id when provided', () => {
    expect(formatGenerationTaskDisplayId({ display_id: 'JB20260525-1137-SP1942', created_at: '2026-05-25T11:42:00.000Z' })).toBe(
      'JB20260525-1137-SP1942',
    );
  });

  it('builds a readable fallback from script id and Beijing task time', () => {
    expect(
      formatGenerationTaskDisplayId({
        script_display_id: 'JB20260525-1137',
        created_at: '2026-05-25T11:42:00.000Z',
      }),
    ).toBe('JB20260525-1137-SP1942');
  });
});
