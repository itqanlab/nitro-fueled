import { IsString, IsNotEmpty, MaxLength, Matches, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MAX_COMMAND_LENGTH = 500;
const COMMAND_RE = /^\/[a-z0-9-]+(?:\s+.+)?$/i;

export class ExecuteCommandDto {
  @ApiProperty({ description: 'The slash command to execute', example: '/nitro-status' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMMAND_LENGTH)
  @Matches(COMMAND_RE, { message: 'command must start with a slash command name and be a single-line string' })
  command!: string;

  @ApiPropertyOptional({ description: 'Optional arguments for the command' })
  @IsObject()
  @IsOptional()
  args?: Record<string, unknown>;
}
