const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_PER_WINDOW = 60; // basic safety default

const buckets = new Map<string, { count: number; resetAt: number }>();

function key(ip: string, route: string) {
  return `${ip}:${route}`;
}

export function rateLimit(ip: string, route: string, max: number = MAX_PER_WINDOW, windowMs: number = WINDOW_MS) {
  const k = key(ip || 'unknown', route);
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.resetAt < now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (b.count >= max) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { allowed: true, remaining: max - b.count };
}

