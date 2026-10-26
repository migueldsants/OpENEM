import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'senhaAntiga123' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'senhaNova456', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
