const CANONICAL_SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
const LEGACY_SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

export function buildSessionId(date: Date = new Date()): string {
  return `SESSION_${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}

export function normalizeSessionId(sessionId: string): string {
  if (CANONICAL_SESSION_ID_RE.test(sessionId)) {
    return sessionId;
  }

  if (LEGACY_SESSION_ID_RE.test(sessionId)) {
    return `${sessionId.slice(0, 18)}T${sessionId.slice(19)}`;
  }

  return sessionId;
}
