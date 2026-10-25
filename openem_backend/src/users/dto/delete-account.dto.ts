import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  // O mesmo teto do login: senha maior que isso nunca foi aceita no cadastro.
  @ApiProperty({
    example: 'senhaForte123',
    description: 'Senha atual, para confirmar a exclusão',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
