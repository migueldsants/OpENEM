import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { POSTS_PAGE_DEFAULT, POSTS_PAGE_MAX } from '../posts-page';

export class ListPostsDto {
  @ApiPropertyOptional({
    description: 'Valor de `nextCursor` da página anterior',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({
    default: POSTS_PAGE_DEFAULT,
    minimum: 1,
    maximum: POSTS_PAGE_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTS_PAGE_MAX)
  limit?: number;
}
