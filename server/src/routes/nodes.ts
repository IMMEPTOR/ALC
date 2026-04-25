import { Router } from 'express';
import { getNodes, getNodeById, createNode, updateNode, deleteNode } from '../controllers/nodesController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const createSchema = {
  line_id: { type: 'objectId' as const, required: true },
  name: { type: 'string' as const, required: true, minLength: 2, maxLength: 128 },
  type: { type: 'string' as const, required: true, minLength: 2, maxLength: 64 },
  ip_address: { type: 'string' as const, required: true, pattern: IP_RE },
  parameters: { type: 'array' as const },
};

const updateSchema = {
  name: { type: 'string' as const, minLength: 2, maxLength: 128 },
  type: { type: 'string' as const, minLength: 2, maxLength: 64 },
  ip_address: { type: 'string' as const, pattern: IP_RE },
  parameters: { type: 'array' as const },
};

router.use(authenticate);
router.get('/', getNodes);
router.get('/:id', getNodeById);
router.post('/', authorize('admin', 'engineer'), validateBody(createSchema), createNode);
router.put('/:id', authorize('admin', 'engineer'), validateBody(updateSchema), updateNode);
router.delete('/:id', authorize('admin'), deleteNode);

export default router;
