/**
 * Anti-pattern rule DTO for API responses.
 * Contains anti-pattern rules grouped by category.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * A group of anti-pattern rules for a specific category.
 */
export class AntiPatternRuleDto {
  @ApiProperty({
    example: 'NestJS',
    description: 'Category or technology this rule set applies to',
  })
  public readonly category!: string;

  @ApiProperty({
    type: [String],
    example: [
      'Never bypass commit hooks with --no-verify',
      'Always validate input at system boundaries',
    ],
    description: 'List of anti-pattern rules for this category',
  })
  public readonly rules!: ReadonlyArray<string>;
}
