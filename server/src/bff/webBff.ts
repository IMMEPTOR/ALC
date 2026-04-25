import { Router, Response } from 'express';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { getReadDb, NODE_READ_MODEL_COLLECTION } from '../readmodels/nodeReadModel';
import { ProductionSite, AssemblyLine, Alert } from '../models';

// BFF for web client (engineer) — full DTO with management data
const router = Router();
router.use(authenticate);

// Aggregated management view: sites + lines + nodes + counts in one response
router.get('/management', authorize('engineer', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getReadDb();
  const match: any = {};
  if (req.user!.role !== 'admin') match.owner_id = req.user!.id;

  const [nodes, sites, lines] = await Promise.all([
    db.collection(NODE_READ_MODEL_COLLECTION).find(match).toArray(),
    ProductionSite.find(req.user!.role === 'admin' ? {} : { created_by: req.user!.id }).lean(),
    AssemblyLine.find().populate('site_id', 'name').lean(),
  ]);

  // Group nodes by site and line for hierarchical UI
  const sitesDto = sites.map((site: any) => {
    const siteLines = lines.filter((l: any) => {
      const sid = typeof l.site_id === 'object' ? l.site_id?._id?.toString() : l.site_id?.toString();
      return sid === site._id.toString();
    });
    const linesDto = siteLines.map((line: any) => {
      const lineNodes = nodes.filter((n: any) => n.line_id === line._id.toString());
      return {
        id: line._id,
        name: line.name,
        status: line.status,
        nodes_count: lineNodes.length,
        online: lineNodes.filter(n => n.status === 'online').length,
        offline: lineNodes.filter(n => n.status === 'offline').length,
      };
    });
    return {
      id: site._id,
      name: site.name,
      location: site.location,
      lines_count: linesDto.length,
      nodes_count: siteLines.reduce((s: number, l: any) => s + nodes.filter((n: any) => n.line_id === l._id.toString()).length, 0),
      lines: linesDto,
    };
  });

  res.json({
    sites: sitesDto,
    all_nodes: nodes.map((n: any) => ({
      id: n.node_id,
      name: n.name,
      type: n.type,
      status: n.status,
      ip: n.ip_address,
      site_name: n.site_name,
      line_name: n.line_name,
      alerts: n.active_alerts_count,
    })),
  });
});

router.get('/monitoring', async (req: AuthRequest, res: Response) => {
  const db = getReadDb();
  const match: any = {};
  if (req.user!.role !== 'admin') match.owner_id = req.user!.id;

  const [nodes, alertsRaw] = await Promise.all([
    db.collection(NODE_READ_MODEL_COLLECTION).find(match).toArray(),
    Alert.find({ status: { $in: ['active', 'acknowledged'] } })
      .populate('node_id', 'name')
      .sort({ created_at: -1 })
      .limit(20)
      .lean(),
  ]);

  res.json({
    nodes: nodes.map((n: any) => ({
      id: n.node_id,
      name: n.name,
      type: n.type,
      status: n.status,
      site: n.site_name,
      line: n.line_name,
      alerts: n.active_alerts_count,
    })),
    recent_alerts: alertsRaw.map((a: any) => ({
      id: a._id,
      severity: a.severity,
      message: a.message,
      node_name: (a.node_id as any)?.name || '',
      at: a.created_at,
    })),
  });
});

export default router;
