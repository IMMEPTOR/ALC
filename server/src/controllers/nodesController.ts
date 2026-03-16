import { Request, Response } from 'express';
import { TechNode } from '../models';

export const getNodes = async (req: Request, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.line_id) filter.line_id = req.query.line_id;
  if (req.query.status) filter.status = req.query.status;
  const nodes = await TechNode.find(filter).populate('line_id', 'name status');
  res.json(nodes);
};

export const getNodeById = async (req: Request, res: Response): Promise<void> => {
  const node = await TechNode.findById(req.params.id).populate('line_id', 'name status');
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  res.json(node);
};

export const createNode = async (req: Request, res: Response): Promise<void> => {
  const { line_id, name, type, ip_address, parameters } = req.body;
  if (!line_id || !name || !type || !ip_address) {
    res.status(400).json({ error: 'line_id, name, type и ip_address обязательны' });
    return;
  }
  const node = await TechNode.create({ line_id, name, type, ip_address, parameters: parameters || [] });
  res.status(201).json(node);
};

export const updateNode = async (req: Request, res: Response): Promise<void> => {
  const node = await TechNode.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  res.json(node);
};

export const deleteNode = async (req: Request, res: Response): Promise<void> => {
  const node = await TechNode.findByIdAndDelete(req.params.id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  res.json({ message: 'Узел удален' });
};
