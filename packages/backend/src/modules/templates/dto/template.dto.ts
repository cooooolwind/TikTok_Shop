import { IsArray, IsObject, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertTemplateDto {
  @IsString()
  name: string;

  @IsString()
  strategy: string;

  @IsObject()
  factors: Record<string, string>;

  @IsArray()
  constraints: string[];

  @IsArray()
  applicable_categories: string[];

  @IsOptional()
  @IsArray()
  derived_from?: string[];
}

export class TemplateListQueryDto {
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
  category?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
