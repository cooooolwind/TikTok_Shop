import { describe, expect, it } from 'vitest';
import { getTemplateModalMode, parseFactors, stringifyFactors } from './templateManager.helpers';

describe('template manager helpers', () => {
  it('opens builtin templates in view mode instead of blocking clicks', () => {
    expect(getTemplateModalMode({ is_builtin: true })).toBe('view');
    expect(getTemplateModalMode({ is_builtin: false })).toBe('edit');
    expect(getTemplateModalMode(null)).toBe('create');
  });

  it('serializes and parses template factors', () => {
    const text = stringifyFactors({ pain: '痛点', solution: '解决方案' });

    expect(text).toContain('pain: 痛点');
    expect(parseFactors(text)).toEqual({ pain: '痛点', solution: '解决方案' });
  });
});
