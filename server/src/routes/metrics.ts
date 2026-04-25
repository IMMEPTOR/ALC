import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getHeatmap } from '../metrics';
import { cacheStats } from '../cache';

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

export default router;
