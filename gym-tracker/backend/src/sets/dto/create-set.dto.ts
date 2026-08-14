import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSetDto {
  @IsUUID('4', { message: 'clientUuid deve ser um UUID v4' })
  clientUuid!: string;

  @IsUUID('4', { message: 'exerciseId deve ser um UUID' })
  exerciseId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  weightKg?: number;

  @IsNumber({}, { message: 'reps deve ser um número' })
  @Min(1)
  @Max(200)
  reps!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isBodyweight?: boolean;

  @IsOptional()
  @IsISO8601()
  performedAt?: string;
}
