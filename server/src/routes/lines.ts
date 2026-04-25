import { Router } from 'express';
import { getLines, getLineById, createLine, updateLine, deleteLine } from '../controllers/linesController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const LINE_STATUSES = ['running', 'stopped', 'maintenance', 'idle'];

const createSchema = {
  site_id: { type: 'objectId' as const, required: true },
  name: { type: 'string' as const, required: true, minLength: 2, maxLength: 128 },
  status: { type: 'string' as const, enum: LINE_STATUSES },
};

const updateSchema = {
  name: { type: 'string' as const, minLength: 2, maxLength: 128 },
  status: { type: 'string' as const, enum: LINE_STATUSES },
};

router.use(authenticate);
router.get('/', getLines);
router.get('/:id', getLineById);
router.post('/', authorize('admin', 'engineer'), validateBody(createSchema), createLine);
router.put('/:id', authorize('admin', 'engineer'), validateBody(updateSchema), updateLine);
router.delete('/:id', authorize('admin'), deleteLine);

export default router;
