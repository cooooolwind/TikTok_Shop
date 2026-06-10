import { IsOptional, IsString } from 'class-validator';
import type { AiSettingsDto } from '@aigc/shared-types';

export class SetTempApiKeyRequestDto implements AiSettingsDto {
  @IsOptional()
  @IsString()
  volcano_api_key?: string;

  @IsOptional()
  @IsString()
  volcano_text_api_key?: string;

  @IsOptional()
  @IsString()
  volcano_text_endpoint?: string;

  @IsOptional()
  @IsString()
  volcano_image_api_key?: string;

  @IsOptional()
  @IsString()
  volcano_image_endpoint?: string;

  @IsOptional()
  @IsString()
  volcano_video_api_key?: string;

  @IsOptional()
  @IsString()
  volcano_video_endpoint?: string;

  @IsOptional()
  @IsString()
  volcano_embedding_api_key?: string;

  @IsOptional()
  @IsString()
  volcano_embedding_endpoint?: string;
}
