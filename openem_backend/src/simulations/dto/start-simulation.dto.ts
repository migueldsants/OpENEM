import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartSimulationDto {
  @ApiProperty({ description: 'Template do simulado (área ou completo)' })
  @IsString()
  templateId!: string;
}
