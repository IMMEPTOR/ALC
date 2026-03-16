import { Router } from 'express';
import { getCommands, createCommand, getCommandById } from '../controllers/commandsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getCommands);
router.get('/:id', getCommandById);
router.post('/', authorize('operator', 'engineer', 'admin'), createCommand);

export default router;
