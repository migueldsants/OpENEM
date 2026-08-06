import { IsInt, IsString, Max, Min } from 'class-validator';

export class SubmitGameScoreDto {
  @IsString()
  gameKey!: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  score!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  level!: number;

  @IsInt()
  @Min(0)
  @Max(86400)
  durationSec!: number;
}
