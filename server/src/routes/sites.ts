import { Router } from 'express';
import { getSites, getSiteById, createSite, updateSite, deleteSite } from '../controllers/sitesController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const createSchema = {
  name: { type: 'string' as const, required: true, minLength: 2, maxLength: 128 },
  location: { type: 'string' as const, required: true, minLength: 2, maxLength: 256 },
};

const updateSchema = {
  name: { type: 'string' as const, minLength: 2, maxLength: 128 },
  location: { type: 'string' as const, minLength: 2, maxLength: 256 },
};

router.use(authenticate);
router.get('/', getSites);
router.get('/:id', getSiteById);
router.post('/', authorize('admin', 'engineer'), validateBody(createSchema), createSite);
router.put('/:id', authorize('admin', 'engineer'), validateBody(updateSchema), updateSite);
router.delete('/:id', authorize('admin'), deleteSite);

export default router;
