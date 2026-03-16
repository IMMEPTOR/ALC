import { Request, Response } from 'express';
import { ProductionSite } from '../models';

export const getSites = async (_req: Request, res: Response): Promise<void> => {
  const sites = await ProductionSite.find();
  res.json(sites);
};

export const getSiteById = async (req: Request, res: Response): Promise<void> => {
  const site = await ProductionSite.findById(req.params.id);
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  res.json(site);
};

export const createSite = async (req: Request, res: Response): Promise<void> => {
  const { name, location } = req.body;
  if (!name || !location) { res.status(400).json({ error: 'name и location обязательны' }); return; }
  const site = await ProductionSite.create({ name, location });
  res.status(201).json(site);
};

export const updateSite = async (req: Request, res: Response): Promise<void> => {
  const site = await ProductionSite.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  res.json(site);
};

export const deleteSite = async (req: Request, res: Response): Promise<void> => {
  const site = await ProductionSite.findByIdAndDelete(req.params.id);
  if (!site) { res.status(404).json({ error: 'Площадка не найдена' }); return; }
  res.json({ message: 'Площадка удалена' });
};
