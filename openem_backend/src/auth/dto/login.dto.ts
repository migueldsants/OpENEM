import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'estudante@exemplo.com' })
  @IsEmail()
  email!: string;

  // Mesmo teto do cadastro: senha maior que isso nunca foi aceita para criar
  // conta, e sem teto um corpo de 100 KB vira 100 KB de argon2.
  @ApiProperty({ example: 'senhaForte123' })
  @IsString()
  @MaxLength(72)
  password!: string;
}
