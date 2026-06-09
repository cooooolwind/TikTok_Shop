import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const MATERIAL_TYPES = ['image', 'video'] as const;
const BASE_CATEGORIES = ['product', 'scene', 'model', 'other'] as const;
const REFERENCE_CATEGORIES = ['beauty', 'apparel', '3c', 'other'] as const;
const MATERIAL_CATEGORIES = [...BASE_CATEGORIES, ...REFERENCE_CATEGORIES];
const MATERIAL_STATUSES = ['uploaded', 'processing', 'ready', 'failed'] as const;

function toTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export class MaterialListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(MATERIAL_TYPES)
  type?: 'image' | 'video';

  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => toTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(MATERIAL_STATUSES)
  status?: 'uploaded' | 'processing' | 'ready' | 'failed';

  @IsOptional()
  @IsString()
  source_declaration?: string;

  @IsOptional()
  @IsString()
  exclude_source_declaration?: string;
}
