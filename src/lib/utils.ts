/**
 * Utility functions for shared application logic.
 */

/**
 * Combines conditional class names cleanly into a single string.
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
