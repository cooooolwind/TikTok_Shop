import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ProductInfo, ScriptMode } from '@aigc/shared-types';

export class SceneInputDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  camera_motion?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  dialogue?: string;

  @IsOptional()
  @IsString()
  bgm_style?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  visual_prompt?: string;

  @IsOptional()
  @IsArray()
  constraints?: string[];
}

export class ScriptPreferencesDto {
  @IsNumber()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['auto', 'enabled', 'disabled'])
  dialogue_mode?: 'auto' | 'enabled' | 'disabled';

  @IsOptional()
  @IsIn(['mixed'])
  dialogue_type?: 'mixed';
}

export class GenerateScriptDto {
  @IsObject()
  product_info: ProductInfo;

  @IsIn(['template', 'imitation', 'free'])
  mode: ScriptMode;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsArray()
  material_ids?: string[];

  @IsOptional()
  @IsString()
  manual_text?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScriptPreferencesDto)
  preferences?: ScriptPreferencesDto;
}

export class CreateScriptDto {
  @IsObject()
  product_info: ProductInfo;

  @IsIn(['template', 'imitation', 'free'])
  mode: ScriptMode;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsArray()
  source_material_ids?: string[];

  @IsOptional()
  @IsString()
  narrative_framework?: string;

  @IsOptional()
  @IsString()
  visual_style?: string;

  @IsOptional()
  @IsNumber()
  total_duration?: number;

  @IsOptional()
  @IsObject()
  script_blueprint?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SceneInputDto)
  scenes?: SceneInputDto[];
}

export class ScriptListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}

