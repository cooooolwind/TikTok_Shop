import { IsString, IsNotEmpty } from 'class-validator';
import type { SetTempApiKeyDto } from '@aigc/shared-types';

export class SetTempApiKeyRequestDto implements SetTempApiKeyDto {
  @IsString()
  @IsNotEmpty()
  payload: string;
}
