import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getReadDb, NODE_READ_MODEL_COLLECTION } from '../readmodels/nodeReadModel';
import { Alert, Command } from '../models';

// BFF for mobile client (operator) — minimal DTO, aggregated for tablet/phone UI
const router = Router();
router.use(authenticate);

// Aggregated dashboard: nodes + stats + active alerts in one request
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const db = getReadDb();
  const match: any = {};
  if (req.user!.role !== 'admin') match.owner_id = req.user!.id;

  const [nodes, statsArr, alertsCount] = await Promise.all([
    db.collection(NODE_READ_MODEL_COLLECTION).find(match).limit(50).toArray(),
    db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]).toArray(),
    db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$active_alerts_count' } } },
    ]).toArray(),
  ]);

  const statusMap: Record<string, number> = {};
  statsArr.forEach(s => { statusMap[s._id] = s.n; });

  // Minimal DTO for mobile — only essential fields
  const nodesDto = nodes.map(n => ({
    id: n.node_id,
    name: n.name,
    status: n.status,
    site: n.site_name,
    alerts: n.active_alerts_count,
  }));

  res.json({
    summary: {
      total: nodes.length,
      online: statusMap.online || 0,
      offline: statusMap.offline || 0,
      warning: (statusMap.warning || 0) + (statusMap.critical || 0),
      alerts: alertsCount[0]?.total || 0,
    },
    nodes: nodesDto,
  });
});

router.get('/node/:id', async (req: AuthRequest, res: Response) => {
  const db = getReadDb();
  const node = await db.collection(NODE_READ_MODEL_COLLECTION).findOne({ node_id: req.params.id });
  if (!node) { res.status(404).json({ error: 'not found' }); return; }
  if (req.user!.role !== 'admin' && node.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'forbidden' }); return;
  }

  const [recentAlerts, recentCommands] = await Promise.all([
    Alert.find({ node_id: req.params.id }).sort({ created_at: -1 }).limit(5).lean(),
    Command.find({ node_id: req.params.id }).sort({ created_at: -1 }).limit(5).lean(),
  ]);

  // Mobile DTO — flat, trimmed for small screen
  res.json({
    id: node.node_id,
    name: node.name,
    type: node.type,
    status: node.status,
    ip: node.ip_address,
    site: node.site_name,
    line: node.line_name,
    alerts_count: node.active_alerts_count,
    recent_alerts: recentAlerts.map(a => ({ id: a._id, severity: a.severity, message: a.message, at: a.created_at })),
    recent_commands: recentCommands.map(c => ({ id: c._id, action: c.action_type, status: c.status, at: c.created_at })),
  });
});

export default router;
