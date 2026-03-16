import { Router } from 'express';
import { getNodes, getNodeById, createNode, updateNode, deleteNode } from '../controllers/nodesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getNodes);
router.get('/:id', getNodeById);
router.post('/', authorize('admin', 'engineer'), createNode);
router.put('/:id', authorize('admin', 'engineer'), updateNode);
router.delete('/:id', authorize('admin'), deleteNode);

export default router;
