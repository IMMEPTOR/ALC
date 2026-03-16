import { Request, Response } from 'express';
import { AssemblyLine } from '../models';

export const getLines = async (req: Request, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.site_id) filter.site_id = req.query.site_id;
  const lines = await AssemblyLine.find(filter).populate('site_id', 'name location');
  res.json(lines);
};

export const getLineById = async (req: Request, res: Response): Promise<void> => {
  const line = await AssemblyLine.findById(req.params.id).populate('site_id', 'name location');
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  res.json(line);
};

export const createLine = async (req: Request, res: Response): Promise<void> => {
  const { site_id, name, status } = req.body;
  if (!site_id || !name) { res.status(400).json({ error: 'site_id и name обязательны' }); return; }
  const line = await AssemblyLine.create({ site_id, name, status });
  res.status(201).json(line);
};

export const updateLine = async (req: Request, res: Response): Promise<void> => {
  const line = await AssemblyLine.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  res.json(line);
};

export const deleteLine = async (req: Request, res: Response): Promise<void> => {
  const line = await AssemblyLine.findByIdAndDelete(req.params.id);
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }
  res.json({ message: 'Линия удалена' });
};
