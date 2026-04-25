import { Response } from 'express';
import { Command, TechNode } from '../models';
import { AuthRequest } from '../middleware/auth';
import { getCommandQueue } from '../queue';
import { recordQueueEvent } from '../metrics';
import logger from '../logger';

export const getCommands = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.node_id) filter.node_id = req.query.node_id;
  if (req.query.status) filter.status = req.query.status;

  // Non-admin users only see their own commands
  if (req.user!.role !== 'admin') {
    filter.user_id = req.user!.id;
  }

  const commands = await Command.find(filter)
    .populate('node_id', 'name type')
    .populate('user_id', 'username')
    .sort({ created_at: -1 })
    .limit(parseInt(req.query.limit as string) || 50);
  res.json(commands);
};

export const createCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { node_id, action_type, parameters } = req.body;
  if (!node_id || !action_type) {
    res.status(400).json({ error: 'node_id и action_type обязательны' });
    return;
  }

  const node = await TechNode.findById(node_id);
  if (!node) {
    res.status(404).json({ error: 'Узел не найден' });
    return;
  }

  const command = await Command.create({
    node_id,
    user_id: req.user!.id,
    action_type,
    parameters: parameters || {},
  });

  // Send to BullMQ queue instead of executing inline
  const queue = getCommandQueue();
  const job = await queue.add('execute-command', {
    commandId: command._id.toString(),
    nodeId: node_id,
    actionType: action_type,
    parameters: parameters || {},
  });
  recordQueueEvent('enqueued');

  logger.info(`Command ${command._id} queued as job ${job.id}`, {
    action: 'command_queued',
    commandId: command._id.toString(),
    jobId: job.id,
    actionType: action_type,
    nodeId: node_id,
    userId: req.user!.id,
  });

  res.status(201).json({ ...command.toObject(), job_id: job.id });
};

export const getCommandById = async (req: AuthRequest, res: Response): Promise<void> => {
  const command = await Command.findById(req.params.id)
    .populate('node_id', 'name type')
    .populate('user_id', 'username');
  if (!command) { res.status(404).json({ error: 'Команда не найдена' }); return; }
  if (req.user!.role !== 'admin' && command.user_id.toString() !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой команде' }); return;
  }
  res.json(command);
};

export const getCommandStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const command = await Command.findById(req.params.id).select('status executed_at action_type parameters');
  if (!command) { res.status(404).json({ error: 'Команда не найдена' }); return; }
  res.json({
    command_id: command._id,
    status: command.status,
    action_type: command.action_type,
    executed_at: command.executed_at,
  });
};
