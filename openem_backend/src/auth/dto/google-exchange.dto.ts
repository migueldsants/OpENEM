import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class GoogleExchangeDto {
  @ApiProperty({ description: 'Código de uso único da volta do Google' })
  @IsString()
  @Length(20, 200)
  code!: string;
}
