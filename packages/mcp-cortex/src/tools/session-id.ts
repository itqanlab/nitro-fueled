const CANONICAL_SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
const LEGACY_SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

export function buildSessionId(date: Date = new Date()): string {
  return `SESSION_${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}

/**
 * Normalizes a session ID to the canonical T-separator format.
 * Returns the canonical ID if already in the correct format.
 * Converts legacy underscore-separator IDs to canonical format.
 * Returns null for inputs that match neither format — callers must guard against null.
 */
export function normalizeSessionId(sessionId: string): string | null {
  if (CANONICAL_SESSION_ID_RE.test(sessionId)) {
    return sessionId;
  }

  if (LEGACY_SESSION_ID_RE.test(sessionId)) {
    // Use regex substitution to replace the underscore between date and time parts with T.
    return sessionId.replace(/^(SESSION_\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/, '$1T$2');
  }

  // Unrecognized format — return null so callers can detect and handle invalid input.
  return null;
}

/**
 * Converts a canonical T-separator session ID to the legacy underscore format.
 * Intended for test utilities only — do not use in production code paths.
 */
export function toLegacySessionId(id: string): string {
  return id.replace(/^(SESSION_\d{4}-\d{2}-\d{2})T/, '$1_');
}
