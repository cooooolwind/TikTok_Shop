import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { CreateReferenceRequest } from '@aigc/shared-types';

export class CreateReferenceDto implements CreateReferenceRequest {
  @ApiProperty({ description: '视频来源URL' })
  @IsString()
  source_url: string;

  @ApiProperty({ description: '平台名称' })
  @IsString()
  source_platform: string;

  @ApiProperty({ description: '类目', required: false })
  @IsString()
  @IsOptional()
  category: string;

  @ApiProperty({ description: '版权声明' })
  @IsString()
  source_declaration: string;
}

export class UploadReferenceDto {
  @ApiProperty({ description: '类目', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: '版权声明' })
  @IsString()
  source_declaration: string;
}
