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
  ValidateIf,
} from 'class-validator';
import { IsNickname } from './nickname.decorator';

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
    minLength: 3,
    maxLength: 20,
    description:
      'Apelido público, único (mesmas regras do cadastro). Não pode voltar a ser nulo.',
  })
  // Nulo é recusado: o @IsOptional deixaria passar e apagaria o apelido.
  @ValidateIf((_, value) => value !== undefined)
  @IsNickname()
  nickname?: string;

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

  @ApiProperty({
    required: false,
    description: 'Marcado como true ao concluir o onboarding inicial',
  })
  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  @ApiProperty({
    required: false,
    enum: ['ingles', 'espanhol'],
    description:
      'Língua estrangeira da prova: define qual versão das questões 1–5 (ou 91–95) aparece nas questões e nos simulados oficiais',
  })
  @IsOptional()
  @IsIn(['ingles', 'espanhol'])
  foreignLanguage?: string;
}
