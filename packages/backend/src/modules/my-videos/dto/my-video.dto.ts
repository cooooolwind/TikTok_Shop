import { IsObject, IsString } from 'class-validator';
import type { TemplateGenerateRequest, TemplateGenerateResult } from '@aigc/shared-types';

export class SaveMyVideoDto {
  @IsString()
  template_id: string;

  @IsString()
  template_name: string;

  @IsObject()
  product_info: TemplateGenerateRequest;

  @IsObject()
  result: TemplateGenerateResult;
}
