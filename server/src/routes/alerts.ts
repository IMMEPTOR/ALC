import { Router } from 'express';
import { getAlerts, getAlertById, acknowledgeAlert, resolveAlert } from '../controllers/alertsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getAlerts);
router.get('/:id', getAlertById);
router.patch('/:id/acknowledge', authorize('operator', 'engineer', 'admin'), acknowledgeAlert);
router.patch('/:id/resolve', authorize('engineer', 'admin'), resolveAlert);

export default router;
