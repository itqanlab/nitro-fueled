/**
 * Truncates a string to the specified maximum length, appending "..." if truncated.
 * The returned string length should be at most `maxLength` (including the "...").
 *
 * @param str - The input string to truncate.
 * @param maxLength - The maximum allowed length of the output string.
 * @returns The original string if within limit, or a truncated string ending with "...".
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '...'; // BUG: should be maxLength - 3
}

/**
 * Capitalizes the first letter of each word in a string.
 * Words are separated by spaces. Multiple consecutive spaces should be preserved.
 *
 * @param str - The input string to capitalize.
 * @returns The string with the first letter of each word uppercased.
 */
export function capitalize(str: string): string {
  return str
    .split(' ')
    .filter((word) => word.length > 0)   // BUG: filters out empty strings caused by
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');                           // consecutive spaces, collapsing "hello  world"
                                          // to "Hello World" instead of "Hello  World"
}

/**
 * Converts a string to a URL-friendly slug (kebab-case, lowercase, no special characters).
 * Accented characters should be stripped or transliterated to their ASCII equivalents.
 *
 * @param str - The input string to slugify.
 * @returns A lowercase, hyphen-separated string safe for use in URLs.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '-') // BUG: replaces accented chars with '-'
    .replace(/\s+/g, '-')          //       instead of stripping/transliterating them
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
