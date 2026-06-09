import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const BASE_CATEGORIES = ['product', 'scene', 'model', 'other'] as const;
const REFERENCE_CATEGORIES = ['beauty', 'apparel', '3c', 'other'] as const;
const MATERIAL_CATEGORIES = [...BASE_CATEGORIES, ...REFERENCE_CATEGORIES];

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
