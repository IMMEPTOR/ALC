import { Router } from 'express';
import { getTelemetry, getLatestTelemetry, createTelemetry } from '../controllers/telemetryController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getTelemetry);
router.get('/latest/:node_id', getLatestTelemetry);
router.post('/', createTelemetry);

export default router;
