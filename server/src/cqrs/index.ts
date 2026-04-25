import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { createNodeCommand, changeNodeStatusCommand, deleteNodeCommand } from './commands/nodeCommands';
import { getNodesQuery, getNodeByIdQuery, getNodesStatsQuery } from './queries/nodeQueries';
import { createLineCommand, changeLineStatusCommand } from './commands/lineCommands';
import { getLinesWithNodeCountsQuery } from './queries/lineQueries';

// CQRS router — strictly separates write and read endpoints
const router = Router();
router.use(authenticate);

// ---- Nodes ----
// Write side — commands (change state, publish events)
router.post('/nodes/commands/create', authorize('engineer', 'admin'), createNodeCommand);
router.post('/nodes/:id/commands/change-status', authorize('engineer', 'admin', 'operator'), changeNodeStatusCommand);
router.delete('/nodes/:id/commands', authorize('engineer', 'admin'), deleteNodeCommand);

// Read side — queries (from denormalized read model, raw MongoDB, no ORM)
router.get('/nodes/queries', getNodesQuery);
router.get('/nodes/queries/stats', getNodesStatsQuery);
router.get('/nodes/:id/queries', getNodeByIdQuery);

// ---- Assembly Lines ----
router.post('/lines/commands/create', authorize('engineer', 'admin'), createLineCommand);
router.post('/lines/:id/commands/change-status', authorize('engineer', 'admin'), changeLineStatusCommand);
router.get('/lines/queries/with-counts', getLinesWithNodeCountsQuery);

export default router;
