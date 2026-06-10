import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const MATERIAL_CATEGORIES = [
  'product', 'scene', 'model', 'apparel_underwear', 'shoes_bags',
  'food_beverage', 'beauty_skincare', 'sports_outdoors', 'daily_necessities',
  'home_textiles', 'maternity_baby', 'health_care', '3c_digital',
  'kitchen_appliances', 'furniture_building', 'jewelry_accessories',
  'toys_instruments', 'books_education', 'gifts_culture', 'fresh_produce',
  'flowers_plants', 'pet_supplies', 'auto_motorcycle', 'watches_accessories',
  'local_life', 'second_hand', 'luxury', 'raw_materials_packaging', 'other'
] as const;
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
