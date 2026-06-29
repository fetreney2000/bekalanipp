const cache = new Map<string, { data: unknown; ts: number }>();

export async function cachedFetch<T>(url: string, ttlMs = 30000): Promise<T> {
  const existing = cache.get(url);
  if (existing && Date.now() - existing.ts < ttlMs) {
    return existing.data as T;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, ts: Date.now() });
  return data as T;
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}
