import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const STUDY_GOALS = ['SISU', 'PROUNI', 'TREINEIRO'] as const;
export type StudyGoal = (typeof STUDY_GOALS)[number];

export class UpdateProfileDto {
  @ApiProperty({ enum: STUDY_GOALS, required: false })
  @IsOptional()
  @IsIn(STUDY_GOALS)
  goal?: StudyGoal;

  @ApiProperty({
    required: false,
    minimum: 5,
    maximum: 1440,
    description: 'Minutos disponíveis para estudo por dia',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutesPerDay?: number;

  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiProperty({
    required: false,
    description: 'Modo sem distrações (interface minimalista)',
  })
  @IsOptional()
  @IsBoolean()
  focusMode?: boolean;

  @ApiProperty({
    required: false,
    description: 'Ativa pontos, sequência e conquistas (Fase 3)',
  })
  @IsOptional()
  @IsBoolean()
  gamificationEnabled?: boolean;
}
