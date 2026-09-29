import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { THEME_TOKEN_KEYS } from '../../common/theme-tokens';
import { IsThemeTokens } from './is-theme-tokens';

const TOKENS_EXAMPLE = Object.fromEntries(
  THEME_TOKEN_KEYS.map((k) => [k, '#d91748']),
);

export class CreateThemeDto {
  @ApiProperty({
    description: 'Nome do tema (único por aluno)',
    example: 'Mar',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 40)
  name!: string;

  @ApiProperty({
    description: 'Lado claro: as 10 cores em #rrggbb',
    example: TOKENS_EXAMPLE,
  })
  @IsThemeTokens()
  light!: Record<string, string>;

  @ApiProperty({
    description: 'Lado escuro: as 10 cores em #rrggbb',
    example: TOKENS_EXAMPLE,
  })
  @IsThemeTokens()
  dark!: Record<string, string>;

  @ApiProperty({
    description: 'Publica na aba Comunidade (nasce privado)',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
