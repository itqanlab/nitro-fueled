/**
 * Review lesson entry DTO for API responses.
 * Contains accumulated lessons learned from code reviews.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * A group of lessons learned for a specific domain and category.
 */
export class LessonEntryDto {
  @ApiProperty({
    example: 'backend',
    description: 'Domain this lesson applies to (e.g., backend, frontend, security)',
  })
  public readonly domain!: string;

  @ApiProperty({
    example: 'Database / Repositories',
    description: 'Category within the domain',
  })
  public readonly category!: string;

  @ApiProperty({
    type: [String],
    example: [
      'Always use transactions for multi-step DB writes',
      'Filter soft-deleted records with deleted_at IS NULL',
    ],
    description: 'List of lessons learned for this category',
  })
  public readonly rules!: ReadonlyArray<string>;
}
