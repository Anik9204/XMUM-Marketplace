interface RateLimitRecord {
  timestamps: number[];
}

export function checkRateLimit(
  key: string,
  maxCalls: number,
  windowMs: number
): boolean {
  const now = Date.now();
  let record: RateLimitRecord = { timestamps: [] };
  try {
    const raw = localStorage.getItem(`rl_${key}`);
    if (raw) record = JSON.parse(raw);
  } catch {}
  record.timestamps = record.timestamps.filter(
    (t) => now - t < windowMs
  );
  if (record.timestamps.length >= maxCalls) return false;
  record.timestamps.push(now);
  try { localStorage.setItem(`rl_${key}`, JSON.stringify(record)); }
  catch {}
  return true;
}
