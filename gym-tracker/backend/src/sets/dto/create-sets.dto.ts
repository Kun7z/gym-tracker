import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSetDto } from './create-set.dto';

export class CreateSetsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Envie pelo menos uma série' })
  @ArrayMaxSize(50, { message: 'Máximo de 50 séries por requisição' })
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets!: CreateSetDto[];
}
