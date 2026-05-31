import { buildScriptGeneratePayload } from './scriptGenerate.helpers';

describe('scriptGenerate helpers', () => {
  it('writes product image urls into generated script product info', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'material',
      product_name: 'Dress',
      product_description: 'Summer dress',
      product_category: 'fashion',
      selling_points: ['light'],
      material_ids: ['material-1'],
      product_image_urls: ['/uploads/materials/dress.jpg'],
      product_image_url: 'https://example.com/manual.png',
      duration: 12,
    });

    expect(payload.product_info.images).toEqual([
      '/uploads/materials/dress.jpg',
      'https://example.com/manual.png',
    ]);
  });
});
