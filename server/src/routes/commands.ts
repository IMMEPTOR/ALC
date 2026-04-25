import { Router } from 'express';
import { getCommands, createCommand, getCommandById, getCommandStatus } from '../controllers/commandsController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const ACTION_TYPES = ['restart', 'stop', 'emergency_stop', 'start', 'calibrate', 'set_parameter', 'diagnostics', 'reset_alerts'];

const createSchema = {
  node_id: { type: 'objectId' as const, required: true },
  action_type: { type: 'string' as const, required: true, enum: ACTION_TYPES },
  parameters: { type: 'object' as const },
};

router.use(authenticate);
router.get('/', getCommands);
router.get('/:id', getCommandById);
router.get('/:id/status', getCommandStatus);
router.post('/', authorize('operator', 'engineer', 'admin'), validateBody(createSchema), createCommand);

export default router;
