import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const MATERIAL_CATEGORIES = ['product', 'scene', 'model', 'other'] as const;

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: 'product' | 'scene' | 'model' | 'other';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
