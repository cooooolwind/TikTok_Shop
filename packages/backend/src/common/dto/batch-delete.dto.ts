import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class BatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids: string[];
}
