import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getReadDb, NODE_READ_MODEL_COLLECTION } from '../../readmodels/nodeReadModel';
import { cacheGet, cacheSet } from '../../cache';

// CQRS Query side for AssemblyLine — aggregates over node_read_model
// (reads are computed from the denormalized read model, no ORM).
const QUERY_TTL_MS = 30_000;

export const getLinesWithNodeCountsQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getReadDb();
  const match: any = {};
  if (req.user!.role !== 'admin') match.owner_id = req.user!.id;

  const cacheKey = `lines:withCounts:${req.user!.id}:${req.user!.role}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(cached);
    return;
  }

  const data = await db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
    { $match: match },
    { $group: {
        _id: '$line_id',
        line_name: { $first: '$line_name' },
        site_name: { $first: '$site_name' },
        nodes_total: { $sum: 1 },
        nodes_online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
        nodes_offline: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
        nodes_warning: { $sum: { $cond: [{ $in: ['$status', ['warning', 'critical']] }, 1, 0] } },
        active_alerts: { $sum: '$active_alerts_count' },
      } },
    { $project: {
        _id: 0,
        line_id: '$_id',
        line_name: 1,
        site_name: 1,
        nodes_total: 1,
        nodes_online: 1,
        nodes_offline: 1,
        nodes_warning: 1,
        active_alerts: 1,
      } },
    { $sort: { line_name: 1 } },
  ]).toArray();

  cacheSet(cacheKey, data, QUERY_TTL_MS, ['lines', 'stats']);
  res.set('X-Cache', 'MISS').json(data);
};
