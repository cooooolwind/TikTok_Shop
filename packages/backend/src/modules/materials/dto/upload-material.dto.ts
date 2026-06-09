import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const BASE_CATEGORIES = ['product', 'scene', 'model', 'other'] as const;
const REFERENCE_CATEGORIES = ['beauty', 'apparel', '3c', 'other'] as const;
const MATERIAL_CATEGORIES = [...BASE_CATEGORIES, ...REFERENCE_CATEGORIES];
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
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: string = 'other';

  @IsIn(SOURCE_DECLARATIONS)
  source_declaration: 'owned' | 'public_commercial' | 'reference';

  @IsOptional()
  @IsString()
  source_platform?: string;

  @IsOptional()
  @Transform(({ value }) => toTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
