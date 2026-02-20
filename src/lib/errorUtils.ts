/**
 * Safe error handling utilities
 */

/**
 * Extracts error message from unknown error type safely.
 * Handles Error objects, strings, and other types.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'An unknown error occurred'
}
