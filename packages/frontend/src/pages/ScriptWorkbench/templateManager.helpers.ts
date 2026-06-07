import type { Template } from '@aigc/shared-types';

export type TemplateModalMode = 'create' | 'edit' | 'view';

export function getTemplateModalMode(template?: Pick<Template, 'is_builtin'> | null): TemplateModalMode {
  if (!template) return 'create';
  return template.is_builtin ? 'view' : 'edit';
}

export function stringifyFactors(factors: Record<string, string> = {}) {
  return Object.entries(factors)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

export function parseFactors(value?: string): Record<string, string> {
  if (!value) return {};
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line, index) => {
      const [rawKey, ...rest] = line.split(':');
      const key = rest.length > 0 ? rawKey.trim() : `factor_${index + 1}`;
      const factorValue = rest.length > 0 ? rest.join(':').trim() : rawKey.trim();
      if (factorValue) acc[key || `factor_${index + 1}`] = factorValue;
      return acc;
    }, {});
}
