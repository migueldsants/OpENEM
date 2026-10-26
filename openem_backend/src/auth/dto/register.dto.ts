import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from './email.transform';

export class RegisterDto {
  @ApiProperty({ example: 'estudante@exemplo.com' })
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Maria', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  // Sem aceite não há conta: o cadastro grava quando e qual versão foi aceita.
  @ApiProperty({
    example: true,
    description:
      'Aceite dos Termos de Uso e da Política de Privacidade (menores de 18 anos usam com ciência do responsável). Tem de ser true.',
  })
  @Equals(true, {
    message:
      'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade',
  })
  acceptTerms!: boolean;
}
