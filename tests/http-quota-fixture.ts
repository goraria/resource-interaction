// Deterministic fixture only; production uses PostgreSQL.
export function quotaFixture() {
  const entries = new Map<string, { totalHits: number; resetTime: Date }>();
  return { async increment(key: string) {
    const now = Date.now(), previous = entries.get(key);
    const entry = previous && previous.resetTime.getTime() > now
      ? { ...previous, totalHits: previous.totalHits + 1 }
      : { totalHits: 1, resetTime: new Date(now + 60_000) };
    entries.set(key, entry); return entry;
  }};
}
