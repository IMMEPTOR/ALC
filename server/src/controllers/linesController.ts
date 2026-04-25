import { Response } from 'express';
import { AssemblyLine, ProductionSite } from '../models';
import { AuthRequest } from '../middleware/auth';

export const getLines = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.site_id) filter.site_id = req.query.site_id;

  if (req.user!.role !== 'admin') {
    // Only lines belonging to sites owned by this user
    const ownedSites = await ProductionSite.find({ created_by: req.user!.id }).select('_id');
    const siteIds = ownedSites.map(s => s._id);
    filter.site_id = filter.site_id ? { $in: siteIds, $eq: filter.site_id } : { $in: siteIds };
  }

  const lines = await AssemblyLine.find(filter)
    .populate('site_id', 'name location')
    .populate('created_by', 'username');
  res.json(lines);
};

export const getLineById = async (req: AuthRequest, res: Response): Promise<void> => {
  const line = await AssemblyLine.findById(req.params.id)
    .populate('site_id', 'name location')
    .populate('created_by', 'username');
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  const lineOwnerId = typeof line.created_by === 'object' && (line.created_by as any)._id
    ? (line.created_by as any)._id.toString() : line.created_by.toString();
  if (req.user!.role !== 'admin' && lineOwnerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой линии' }); return;
  }
  res.json(line);
};

export const createLine = async (req: AuthRequest, res: Response): Promise<void> => {
  const { site_id, name, status } = req.body;
  if (!site_id || !name) { res.status(400).json({ error: 'site_id и name обязательны' }); return; }
  const line = await AssemblyLine.create({ site_id, name, status, created_by: req.user!.id });
  res.status(201).json(line);
};

export const updateLine = async (req: AuthRequest, res: Response): Promise<void> => {
  const line = await AssemblyLine.findById(req.params.id);
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  if (req.user!.role !== 'admin' && line.created_by.toString() !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой линии' }); return;
  }
  const updated = await AssemblyLine.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteLine = async (req: AuthRequest, res: Response): Promise<void> => {
  const line = await AssemblyLine.findById(req.params.id);
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  if (req.user!.role !== 'admin' && line.created_by.toString() !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой линии' }); return;
  }
  await AssemblyLine.findByIdAndDelete(req.params.id);
  res.json({ message: 'Линия удалена' });
};
