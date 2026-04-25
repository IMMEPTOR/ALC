import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getHeatmap, resetMetrics } from '../metrics';
import { cacheStats, cacheClear, cacheInvalidate } from '../cache';
import logger from '../logger';

// 5.2 — heatmap endpoint exposes hot points (frequent endpoints, heavy commands, queue stats)
const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'engineer'));

router.get('/heatmap', (_req: AuthRequest, res: Response) => {
  res.json({
    cache: cacheStats(),
    ...getHeatmap(),
  });
});

router.get('/cache', (_req: AuthRequest, res: Response) => {
  res.json(cacheStats());
});

// Manual cache invalidation by tag (operations / debugging).
// Admin only — drops every key carrying any of the supplied tags.
router.post('/cache/invalidate', authorize('admin'), (req: AuthRequest, res: Response) => {
  const tags: string[] = Array.isArray(req.body?.tags) ? req.body.tags : [];
  if (!tags.length) { res.status(400).json({ error: 'tags обязателен (массив строк)' }); return; }
  const removed = cacheInvalidate(tags);
  logger.info(`Manual cache invalidation`, { action: 'cache_invalidate_manual', tags, removed, by: req.user!.id });
  res.json({ removed, tags });
});

// Drops the entire cache (admin only).
router.delete('/cache', authorize('admin'), (req: AuthRequest, res: Response) => {
  cacheClear();
  logger.warn(`Full cache cleared`, { action: 'cache_clear', by: req.user!.id });
  res.json({ cleared: true });
});

// Resets all in-memory metrics counters (admin only).
// Useful to start a clean measurement window — e.g. during load testing.
router.post('/reset', authorize('admin'), (req: AuthRequest, res: Response) => {
  resetMetrics();
  logger.warn(`Metrics counters reset`, { action: 'metrics_reset', by: req.user!.id });
  res.json({ reset: true });
});

export default router;
