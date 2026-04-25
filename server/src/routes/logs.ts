import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'engineer'));

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const level = (req.query.level as string) || 'all';
  const limit = parseInt(req.query.limit as string) || 100;
  const logFile = level === 'error' ? 'error.log' : 'combined.log';
  const logPath = path.join(__dirname, '../../logs', logFile);

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const parsed = lines.map(line => {
      try { return JSON.parse(line); } catch { return { message: line }; }
    });
    const result = parsed.reverse().slice(0, limit);
    res.json(result);
  } catch {
    res.json([]);
  }
});

export default router;
