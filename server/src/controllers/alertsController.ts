import { Request, Response } from 'express';
import { Alert } from '../models';

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.node_id) filter.node_id = req.query.node_id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;

  const alerts = await Alert.find(filter)
    .populate('node_id', 'name type status')
    .sort({ created_at: -1 })
    .limit(parseInt(req.query.limit as string) || 50);
  res.json(alerts);
};

export const getAlertById = async (req: Request, res: Response): Promise<void> => {
  const alert = await Alert.findById(req.params.id).populate('node_id', 'name type status');
  if (!alert) { res.status(404).json({ error: 'Аларм не найден' }); return; }
  res.json(alert);
};

export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: 'acknowledged' },
    { new: true }
  );
  if (!alert) { res.status(404).json({ error: 'Аларм не найден' }); return; }
  res.json(alert);
};

export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved', resolved_at: new Date() },
    { new: true }
  );
  if (!alert) { res.status(404).json({ error: 'Аларм не найден' }); return; }
  res.json(alert);
};
