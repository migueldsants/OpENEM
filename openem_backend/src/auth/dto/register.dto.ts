import { ApiProperty } from '@nestjs/swagger';
import {
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
}
