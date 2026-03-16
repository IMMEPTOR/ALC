import { Router } from 'express';
import { getSites, getSiteById, createSite, updateSite, deleteSite } from '../controllers/sitesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getSites);
router.get('/:id', getSiteById);
router.post('/', authorize('admin', 'engineer'), createSite);
router.put('/:id', authorize('admin', 'engineer'), updateSite);
router.delete('/:id', authorize('admin'), deleteSite);

export default router;
