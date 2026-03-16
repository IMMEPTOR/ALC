import { Router } from 'express';
import { getLines, getLineById, createLine, updateLine, deleteLine } from '../controllers/linesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getLines);
router.get('/:id', getLineById);
router.post('/', authorize('admin', 'engineer'), createLine);
router.put('/:id', authorize('admin', 'engineer'), updateLine);
router.delete('/:id', authorize('admin'), deleteLine);

export default router;
