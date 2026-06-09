import { buildManualDraftPayload, buildScriptGeneratePayload } from './scriptGenerate.helpers';

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

  it('keeps selected library materials for template generation', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'template',
      product_name: 'Camera',
      product_description: 'Pocket camera',
      product_category: 'electronics',
      selling_points: ['portable'],
      template_id: 'template-1',
      material_ids: ['video-1'],
      duration: 12,
    });

    expect(payload.mode).toBe('template');
    expect(payload.material_ids).toEqual(['video-1']);
  });

  it('keeps selected library materials for pasted text parsing', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'manual_text',
      product_name: 'Snack',
      product_description: 'Crispy snack',
      product_category: 'food',
      selling_points: ['crispy'],
      manual_text: 'Scene 1',
      material_ids: ['video-1'],
      duration: 12,
    });

    expect(payload.mode).toBe('free');
    expect(payload.material_ids).toEqual(['video-1']);
  });

  it('writes dialogue generation strategy into script preferences', () => {
    const modes = ['auto', 'enabled', 'disabled'] as const;

    for (const dialogue_mode of modes) {
      const payload = buildScriptGeneratePayload({
        entry: 'material',
        product_name: 'Camera',
        product_description: 'Pocket camera',
        product_category: 'electronics',
        selling_points: ['portable'],
        duration: 12,
        dialogue_mode,
      });

      expect(payload.preferences).toEqual(
        expect.objectContaining({
          dialogue_mode,
          dialogue_type: 'mixed',
        }),
      );
    }
  });

  it('stores selected library materials on manually structured drafts', () => {
    const payload = buildManualDraftPayload({
      entry: 'manual_structured',
      product_name: 'Dress',
      product_description: 'Summer dress',
      product_category: 'fashion',
      selling_points: ['light'],
      material_ids: ['video-1'],
      duration: 12,
    });

    expect(payload.source_material_ids).toEqual(['video-1']);
  });
});
