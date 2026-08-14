import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class HistoryQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tz?: string;
}
