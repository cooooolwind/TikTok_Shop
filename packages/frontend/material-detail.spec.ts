import { describe, expect, it } from 'vitest';
import { getMaterialDetailCollections } from './src/pages/MaterialManagement/MaterialDetail';

describe('MaterialDetail view data', () => {
  it('defaults optional arrays to empty arrays', () => {
    const result = getMaterialDetailCollections({});

    expect(result.aiTags).toEqual([]);
    expect(result.slices).toEqual([]);
  });
});
