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

/**
 * Safely parses JSON with error handling.
 * Returns null if parsing fails instead of throwing.
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Safely parses JSON with a default value fallback.
 */
export function safeJsonParseWithDefault<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

/**
 * Validates a filename to prevent path traversal attacks.
 * Returns true if filename is safe, false otherwise.
 */
export function isValidFilename(filename: string): boolean {
  // Reject empty or too long filenames
  if (!filename || filename.length > 255) return false

  // Reject path separators and path traversal attempts
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false
  }

  // Reject null bytes and control characters
  if (/[\x00-\x1f]/.test(filename)) return false

  // Only allow expected backup filename pattern
  // jurisdesk_auto_YYYY-MM-DDTHH-MM-SS-mmmZ.json
  const validPattern = /^jurisdesk_auto_\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/
  return validPattern.test(filename)
}

/**
 * Creates a standardized error response for async operations
 */
export interface AsyncResult<T> {
  success: boolean
  data?: T
  error?: string
}

export function success<T>(data: T): AsyncResult<T> {
  return { success: true, data }
}

export function failure<T>(error: unknown): AsyncResult<T> {
  return { success: false, error: getErrorMessage(error) }
}
