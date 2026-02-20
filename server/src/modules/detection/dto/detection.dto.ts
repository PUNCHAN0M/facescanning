import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDetectionLogDto {
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @IsUUID()
  @IsNotEmpty()
  cameraId: string;

  @IsString()
  @IsOptional()
  imagePath?: string;

  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  @IsNumber()
  @IsOptional()
  confidence?: number;
}

export class DetectionQueryDto {
  @IsUUID()
  @IsOptional()
  personId?: string;

  @IsUUID()
  @IsOptional()
  cameraId?: string;

  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
