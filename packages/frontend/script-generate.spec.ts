import { describe, expect, it } from 'vitest';
import {
  buildManualDraftPayload,
  buildScriptGeneratePayload,
  getScriptStatusView,
} from './src/pages/ScriptWorkbench/scriptGenerate.helpers';

describe('script generation helpers', () => {
  it('builds material-driven queued generation payloads', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'material',
      product_name: 'Dress',
      product_description: 'Light dress',
      product_category: 'fashion',
      selling_points: ['breathable'],
      material_ids: ['material-1', 'material-2'],
      duration: 15,
      language: 'zh',
    });

    expect(payload).toMatchObject({
      mode: 'imitation',
      material_ids: ['material-1', 'material-2'],
      product_info: { name: 'Dress' },
    });
  });

  it('builds template queued generation payloads', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'template',
      product_name: 'Dress',
      product_description: 'Light dress',
      product_category: 'fashion',
      selling_points: [],
      template_id: 'template-1',
      duration: 20,
    });

    expect(payload.mode).toBe('template');
    expect(payload.template_id).toBe('template-1');
  });

  it('builds manual text import payloads', () => {
    const payload = buildScriptGeneratePayload({
      entry: 'manual_text',
      product_name: 'Dress',
      product_description: 'Light dress',
      product_category: 'fashion',
      selling_points: [],
      manual_text: 'Scene 1: opening shot.',
      duration: 15,
    });

    expect(payload.mode).toBe('free');
    expect(payload.manual_text).toBe('Scene 1: opening shot.');
  });

  it('builds structured manual draft payloads without queue semantics', () => {
    const payload = buildManualDraftPayload({
      product_name: 'Dress',
      product_description: 'Light dress',
      product_category: 'fashion',
      selling_points: ['breathable'],
      duration: 15,
    });

    expect(payload).toMatchObject({
      mode: 'free',
      total_duration: 15,
      scenes: [],
    });
  });

  it('returns user-facing status metadata for generating and failed scripts', () => {
    expect(getScriptStatusView('generating')).toMatchObject({ color: 'processing', canRetry: false });
    expect(getScriptStatusView('failed')).toMatchObject({ color: 'error', canRetry: true });
  });
});
