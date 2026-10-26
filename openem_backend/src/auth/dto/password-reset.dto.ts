import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'estudante@exemplo.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token do link enviado por e-mail' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ example: 'senhaNova456', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
