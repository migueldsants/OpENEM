import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSessionDto {
  @ApiProperty({ description: 'Marca a sessão como concluída ou não' })
  @IsBoolean()
  done!: boolean;
}
