import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetSuggestionsDto {
  @ApiPropertyOptional({ description: 'Current dashboard route path' })
  @IsString()
  @IsOptional()
  route?: string;

  @ApiPropertyOptional({ description: 'Current task ID context', example: 'TASK_2026_213' })
  @IsString()
  @IsOptional()
  @Matches(/^TASK_\d{4}_\d{3}$/, { message: 'Invalid taskId format' })
  taskId?: string;
}
