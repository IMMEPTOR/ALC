import { Response } from 'express';
import { ProductionSite } from '../models';
import { AuthRequest } from '../middleware/auth';

export const getSites = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.user!.role !== 'admin') {
    filter.created_by = req.user!.id;
  }
  const sites = await ProductionSite.find(filter).populate('created_by', 'username');
  res.json(sites);
};

export const getSiteById = async (req: AuthRequest, res: Response): Promise<void> => {
  const site = await ProductionSite.findById(req.params.id).populate('created_by', 'username');
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  const siteOwnerId = typeof site.created_by === 'object' && (site.created_by as any)._id
    ? (site.created_by as any)._id.toString() : site.created_by.toString();
  if (req.user!.role !== 'admin' && siteOwnerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой площадке' }); return;
  }
  res.json(site);
};

export const createSite = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, location } = req.body;
  if (!name || !location) { res.status(400).json({ error: 'name и location обязательны' }); return; }
  const site = await ProductionSite.create({ name, location, created_by: req.user!.id });
  res.status(201).json(site);
};

export const updateSite = async (req: AuthRequest, res: Response): Promise<void> => {
  const site = await ProductionSite.findById(req.params.id);
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  if (req.user!.role !== 'admin' && site.created_by.toString() !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой площадке' }); return;
  }
  const updated = await ProductionSite.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteSite = async (req: AuthRequest, res: Response): Promise<void> => {
  const site = await ProductionSite.findById(req.params.id);
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  if (req.user!.role !== 'admin' && site.created_by.toString() !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой площадке' }); return;
  }
  await ProductionSite.findByIdAndDelete(req.params.id);
  res.json({ message: 'Площадка удалена' });
};
