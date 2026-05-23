import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const MATERIAL_CATEGORIES = ['product', 'scene', 'model', 'other'] as const;
const SOURCE_DECLARATIONS = ['owned', 'public_commercial', 'reference'] as const;

function toTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export class UploadMaterialDto {
  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: 'product' | 'scene' | 'model' | 'other' = 'other';

  @IsIn(SOURCE_DECLARATIONS)
  source_declaration: 'owned' | 'public_commercial' | 'reference';

  @IsOptional()
  @Transform(({ value }) => toTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
