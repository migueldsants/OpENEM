import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const COMMUNITY_SORTS = ['popular', 'recent'] as const;
export type CommunitySort = (typeof COMMUNITY_SORTS)[number];

export class ListCommunityThemesDto {
  @ApiProperty({ enum: COMMUNITY_SORTS, required: false, default: 'popular' })
  @IsOptional()
  @IsIn(COMMUNITY_SORTS)
  sort?: CommunitySort;

  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;

  @ApiProperty({ required: false, default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  skip?: number;
}
