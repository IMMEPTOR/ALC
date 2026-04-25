import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getReadDb, NODE_READ_MODEL_COLLECTION } from '../../readmodels/nodeReadModel';
import { cacheGet, cacheSet } from '../../cache';

// CQRS Query side — reads from denormalized read model via raw MongoDB driver
// No ORM used — direct collection access for performance
// Caches results in-memory; commands invalidate by tag (см. cache invalidation).
const QUERY_TTL_MS = 30_000;

export const getNodesQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getReadDb();
  const filter: any = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.line_id) filter.line_id = req.query.line_id;
  if (req.query.site_id) filter.site_id = req.query.site_id;

  // 6.1.2 — ownership comes from token, not from request
  if (req.user!.role !== 'admin') {
    filter.owner_id = req.user!.id;
  }

  const cacheKey = `nodes:list:${JSON.stringify(filter)}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(cached);
    return;
  }

  const nodes = await db.collection(NODE_READ_MODEL_COLLECTION)
    .find(filter)
    .sort({ name: 1 })
    .limit(200)
    .toArray();

  cacheSet(cacheKey, nodes, QUERY_TTL_MS, ['nodes']);
  res.set('X-Cache', 'MISS').json(nodes);
};

export const getNodeByIdQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getReadDb();
  const cacheKey = `nodes:byId:${req.params.id}:${req.user!.id}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(cached);
    return;
  }

  const node = await db.collection(NODE_READ_MODEL_COLLECTION).findOne({ node_id: req.params.id });
  if (!node) { res.status(404).json({ error: 'Узел не найден (read model)' }); return; }
  if (req.user!.role !== 'admin' && node.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этому узлу' }); return;
  }

  cacheSet(cacheKey, node, QUERY_TTL_MS, ['nodes', `node:${req.params.id}`]);
  res.set('X-Cache', 'MISS').json(node);
};

export const getNodesStatsQuery = async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getReadDb();
  const match: any = {};
  if (req.user!.role !== 'admin') match.owner_id = req.user!.id;

  const cacheKey = `nodes:stats:${req.user!.id}:${req.user!.role}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(cached);
    return;
  }

  const stats = await db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
    { $match: match },
    { $group: {
        _id: '$status',
        count: { $sum: 1 },
        alerts_total: { $sum: '$active_alerts_count' },
      } },
  ]).toArray();

  const total = stats.reduce((s, x) => s + x.count, 0);
  const byStatus: Record<string, number> = {};
  let alertsTotal = 0;
  stats.forEach(s => {
    byStatus[s._id] = s.count;
    alertsTotal += s.alerts_total;
  });

  const payload = {
    total,
    online: byStatus.online || 0,
    warning: byStatus.warning || 0,
    critical: byStatus.critical || 0,
    offline: byStatus.offline || 0,
    active_alerts: alertsTotal,
  };
  cacheSet(cacheKey, payload, QUERY_TTL_MS, ['nodes', 'stats']);
  res.set('X-Cache', 'MISS').json(payload);
};
