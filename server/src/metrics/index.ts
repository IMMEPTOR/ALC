// 5.2 — heat map data: per-endpoint hit counts + duration sums to find hot points.
// Updated by requestLogger middleware on every response.

interface EndpointStats {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  errors4xx: number;
  errors5xx: number;
  lastAt: string;
}

const endpointStats = new Map<string, EndpointStats>();

const commandStats = new Map<string, { count: number; totalMs: number; failed: number }>();

const queueStats = {
  enqueued: 0,
  completed: 0,
  failed: 0,
};

// Normalize URL: replace ObjectIds with `:id` so we don't get a unique key per id
const OBJECT_ID_RE = /\/[a-fA-F0-9]{24}(?=\/|$|\?)/g;
function normalize(url: string): string {
  const path = url.split('?')[0];
  return path.replace(OBJECT_ID_RE, '/:id');
}

export function recordRequest(method: string, url: string, status: number, durationMs: number): void {
  const key = `${method} ${normalize(url)}`;
  const s = endpointStats.get(key) || {
    count: 0, totalDurationMs: 0, maxDurationMs: 0, errors4xx: 0, errors5xx: 0, lastAt: '',
  };
  s.count++;
  s.totalDurationMs += durationMs;
  if (durationMs > s.maxDurationMs) s.maxDurationMs = durationMs;
  if (status >= 500) s.errors5xx++;
  else if (status >= 400) s.errors4xx++;
  s.lastAt = new Date().toISOString();
  endpointStats.set(key, s);
}

export function recordCommand(actionType: string, durationMs: number, failed: boolean): void {
  const s = commandStats.get(actionType) || { count: 0, totalMs: 0, failed: 0 };
  s.count++;
  s.totalMs += durationMs;
  if (failed) s.failed++;
  commandStats.set(actionType, s);
}

export function recordQueueEvent(kind: 'enqueued' | 'completed' | 'failed'): void {
  queueStats[kind]++;
}

export function getHeatmap() {
  const endpoints = Array.from(endpointStats.entries()).map(([key, s]) => ({
    endpoint: key,
    requests: s.count,
    avg_ms: Math.round(s.totalDurationMs / s.count),
    max_ms: s.maxDurationMs,
    errors_4xx: s.errors4xx,
    errors_5xx: s.errors5xx,
    last_at: s.lastAt,
  })).sort((a, b) => b.requests - a.requests);

  const commands = Array.from(commandStats.entries()).map(([action, s]) => ({
    action,
    count: s.count,
    avg_ms: Math.round(s.totalMs / s.count),
    failed: s.failed,
  })).sort((a, b) => b.count - a.count);

  // Hot points = top 5 by request volume + top 3 by avg latency
  const hotByVolume = endpoints.slice(0, 5);
  const hotByLatency = [...endpoints].sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 3);

  return {
    summary: {
      total_endpoints: endpoints.length,
      total_requests: endpoints.reduce((s, e) => s + e.requests, 0),
      queue: queueStats,
    },
    hot_points: {
      by_volume: hotByVolume,
      by_latency: hotByLatency,
      heavy_commands: commands.slice(0, 5),
    },
    endpoints,
    commands,
  };
}

export function resetMetrics(): void {
  endpointStats.clear();
  commandStats.clear();
  queueStats.enqueued = 0;
  queueStats.completed = 0;
  queueStats.failed = 0;
}
