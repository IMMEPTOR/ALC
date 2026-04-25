import { Response } from 'express';
import { TechNode, AssemblyLine, ProductionSite } from '../models';
import { AuthRequest } from '../middleware/auth';

export const getNodes = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.line_id) filter.line_id = req.query.line_id;
  if (req.query.status) filter.status = req.query.status;

  if (req.user!.role !== 'admin') {
    // Only nodes belonging to lines on sites owned by this user
    const ownedSites = await ProductionSite.find({ created_by: req.user!.id }).select('_id');
    const ownedLines = await AssemblyLine.find({ site_id: { $in: ownedSites.map(s => s._id) } }).select('_id');
    filter.line_id = filter.line_id
      ? { $in: ownedLines.map(l => l._id), $eq: filter.line_id }
      : { $in: ownedLines.map(l => l._id) };
  }

  const nodes = await TechNode.find(filter)
    .populate({ path: 'line_id', select: 'name status site_id', populate: { path: 'site_id', select: 'name' } })
    .populate('created_by', 'username');
  res.json(nodes);
};

export const getNodeById = async (req: AuthRequest, res: Response): Promise<void> => {
  const node = await TechNode.findById(req.params.id)
    .populate({ path: 'line_id', select: 'name status site_id', populate: { path: 'site_id', select: 'name' } })
    .populate('created_by', 'username');
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  const ownerId = typeof node.created_by === 'object' && node.created_by._id
    ? node.created_by._id.toString() : node.created_by.toString();
  if (req.user!.role !== 'admin' && ownerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этому узлу' }); return;
  }
  res.json(node);
};

export const createNode = async (req: AuthRequest, res: Response): Promise<void> => {
  const { line_id, name, type, ip_address, parameters } = req.body;
  if (!line_id || !name || !type || !ip_address) {
    res.status(400).json({ error: 'line_id, name, type и ip_address обязательны' });
    return;
  }
  const node = await TechNode.create({ line_id, name, type, ip_address, parameters: parameters || [], created_by: req.user!.id });
  res.status(201).json(node);
};

export const updateNode = async (req: AuthRequest, res: Response): Promise<void> => {
  const node = await TechNode.findById(req.params.id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  const updateOwnerId = typeof node.created_by === 'object' && (node.created_by as any)._id
    ? (node.created_by as any)._id.toString() : node.created_by.toString();
  if (req.user!.role !== 'admin' && updateOwnerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этому узлу' }); return;
  }
  const updated = await TechNode.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteNode = async (req: AuthRequest, res: Response): Promise<void> => {
  const node = await TechNode.findById(req.params.id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  const deleteOwnerId = typeof node.created_by === 'object' && (node.created_by as any)._id
    ? (node.created_by as any)._id.toString() : node.created_by.toString();
  if (req.user!.role !== 'admin' && deleteOwnerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этому узлу' }); return;
  }
  await TechNode.findByIdAndDelete(req.params.id);
  res.json({ message: 'Узел удален' });
};
