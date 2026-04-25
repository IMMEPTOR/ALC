import logger from '../logger';

// Simple in-memory TTL cache with tag-based invalidation.
// Used by query side (5 — cache after queries, invalidate on commands).
interface Entry {
  value: any;
  expiresAt: number;
  tags: string[];
}

const store = new Map<string, Entry>();
const tagIndex = new Map<string, Set<string>>();

let hits = 0;
let misses = 0;

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) { misses++; return null; }
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    misses++;
    return null;
  }
  hits++;
  return e.value as T;
}

export function cacheSet(key: string, value: any, ttlMs: number, tags: string[] = []): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs, tags });
  for (const tag of tags) {
    if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
    tagIndex.get(tag)!.add(key);
  }
}

// Invalidate all keys carrying any of the given tags.
// Called from command handlers after a successful write.
export function cacheInvalidate(tags: string[]): number {
  let removed = 0;
  for (const tag of tags) {
    const keys = tagIndex.get(tag);
    if (!keys) continue;
    for (const key of keys) {
      if (store.delete(key)) removed++;
    }
    tagIndex.delete(tag);
  }
  if (removed > 0) {
    logger.info(`Cache invalidated ${removed} keys for tags: ${tags.join(', ')}`, { action: 'cache_invalidated', tags, removed });
  }
  return removed;
}

export function cacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    size: store.size,
    hits,
    misses,
    hitRate: total === 0 ? 0 : Number((hits / total).toFixed(3)),
  };
}

export function cacheClear(): void {
  store.clear();
  tagIndex.clear();
}
