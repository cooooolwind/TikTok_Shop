import { hasScriptProductImageInput } from './createTask.helpers';
import type { Script } from '@aigc/shared-types';

const baseScript: Script = {
  id: 'script-1',
  product_info: {
    name: 'Dress',
    description: 'Summer dress',
    category: 'fashion',
    selling_points: [],
  },
  source_material_ids: [],
  mode: 'free',
  narrative_framework: '',
  visual_style: '',
  total_duration: 12,
  scenes: [],
  status: 'confirmed',
  created_at: '2026-05-31T00:00:00.000Z',
  updated_at: '2026-05-31T00:00:00.000Z',
};

describe('create task helpers', () => {
  it('blocks scripts without product image urls or source materials', () => {
    expect(hasScriptProductImageInput(baseScript)).toBe(false);
  });

  it('allows scripts with product image urls', () => {
    expect(
      hasScriptProductImageInput({
        ...baseScript,
        product_info: { ...baseScript.product_info, images: ['https://example.com/product.png'] },
      }),
    ).toBe(true);
  });

  it('allows scripts with source materials for backend image validation', () => {
    expect(hasScriptProductImageInput({ ...baseScript, source_material_ids: ['material-1'] })).toBe(true);
  });
});
