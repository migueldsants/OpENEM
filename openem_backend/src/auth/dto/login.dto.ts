import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'estudante@exemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senhaForte123' })
  @IsString()
  password!: string;
}
