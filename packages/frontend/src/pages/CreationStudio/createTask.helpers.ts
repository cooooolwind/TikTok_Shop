import type { Script } from '@aigc/shared-types';

export function hasScriptProductImageInput(script: Script | null | undefined) {
  if (!script) return false;
  return Boolean((script.product_info.images ?? []).some(Boolean) || (script.source_material_ids ?? []).length > 0);
}
