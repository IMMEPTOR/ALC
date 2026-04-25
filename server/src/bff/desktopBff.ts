import { Router, Response } from 'express';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { getReadDb, NODE_READ_MODEL_COLLECTION } from '../readmodels/nodeReadModel';
import { User, Command, Alert, ProductionSite } from '../models';

// BFF for desktop client (admin) — full analytics DTO with cross-entity aggregation
const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// Mega-aggregation: full admin analytics in one call
router.get('/analytics', async (_req: AuthRequest, res: Response) => {
  const db = getReadDb();

  const [nodesByStatus, nodesByType, topProblemNodes, usersCount, sitesCount, recentCommands, activeAlerts] = await Promise.all([
    db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]).toArray(),
    db.collection(NODE_READ_MODEL_COLLECTION).aggregate([
      { $group: { _id: '$type', n: { $sum: 1 } } },
    ]).toArray(),
    db.collection(NODE_READ_MODEL_COLLECTION).find({ active_alerts_count: { $gt: 0 } })
      .sort({ active_alerts_count: -1 })
      .limit(5)
      .toArray(),
    User.countDocuments(),
    ProductionSite.countDocuments(),
    Command.find().populate('node_id', 'name').populate('user_id', 'username')
      .sort({ created_at: -1 })
      .limit(10)
      .lean(),
    Alert.countDocuments({ status: { $in: ['active', 'acknowledged'] } }),
  ]);

  const statusMap: Record<string, number> = {};
  nodesByStatus.forEach(s => { statusMap[s._id] = s.n; });

  res.json({
    overview: {
      users: usersCount,
      sites: sitesCount,
      nodes_total: nodesByStatus.reduce((s, x) => s + x.n, 0),
      nodes_online: statusMap.online || 0,
      nodes_offline: statusMap.offline || 0,
      nodes_warning: (statusMap.warning || 0) + (statusMap.critical || 0),
      active_alerts: activeAlerts,
    },
    nodes_by_type: nodesByType.map(t => ({ type: t._id, count: t.n })),
    top_problem_nodes: topProblemNodes.map(n => ({
      id: n.node_id,
      name: n.name,
      site: n.site_name,
      alerts: n.active_alerts_count,
      status: n.status,
    })),
    recent_commands: recentCommands.map(c => ({
      id: c._id,
      action: c.action_type,
      status: c.status,
      node: (c.node_id as any)?.name || '',
      user: (c.user_id as any)?.username || '',
      at: c.created_at,
    })),
  });
});

router.get('/users-with-stats', async (_req: AuthRequest, res: Response) => {
  const db = getReadDb();
  const users = await User.find().lean();

  const usersWithStats = await Promise.all(users.map(async (u) => {
    const [nodesOwned, commandsIssued] = await Promise.all([
      db.collection(NODE_READ_MODEL_COLLECTION).countDocuments({ owner_id: u._id.toString() }),
      Command.countDocuments({ user_id: u._id }),
    ]);
    return {
      id: u._id,
      username: u.username,
      role: (u.role_id as any)?.toString() || '',
      active: u.is_active,
      nodes_owned: nodesOwned,
      commands_issued: commandsIssued,
    };
  }));

  res.json({ users: usersWithStats });
});

export default router;
