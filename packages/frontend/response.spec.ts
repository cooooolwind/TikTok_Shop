import { describe, expect, it } from 'vitest';
import { asArray, unwrapResponse } from './src/services/response';

describe('service response helpers', () => {
  it('unwraps backend ApiResponse envelopes', () => {
    const data = unwrapResponse({
      code: 0,
      data: [{ id: 'material-1' }],
      message: 'success',
    });

    expect(data).toEqual([{ id: 'material-1' }]);
  });

  it('keeps raw responses unchanged when no envelope is present', () => {
    const raw = [{ id: 'material-1' }];

    expect(unwrapResponse(raw)).toBe(raw);
  });

  it('normalizes non-array values to an empty array', () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray({ items: [] })).toEqual([]);
  });
});
