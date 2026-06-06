import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
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

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsIn(['enabled', 'disabled'])
  status?: 'enabled' | 'disabled';
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

  @IsOptional()
  @IsIn(['enabled', 'disabled'])
  status?: 'enabled' | 'disabled';
}

export class GenerateTemplateDto {
  @IsString()
  productName: string;

  @IsString()
  category: string;

  @IsString()
  sellingPoints: string;

  @IsString()
  price: string;

  @IsString()
  targetUser: string;

  @IsOptional()
  @IsString()
  promotion?: string;

  @IsString()
  duration: string;

  @IsString()
  style: string;
}
