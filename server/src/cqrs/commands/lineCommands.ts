import { Response } from 'express';
import { AssemblyLine } from '../../models';
import { AuthRequest } from '../../middleware/auth';
import { publish } from '../../events/eventBus';
import { cacheInvalidate } from '../../cache';
import logger from '../../logger';

// CQRS Command side for AssemblyLine — mirrors nodeCommands pattern.
// Writes go through Mongoose, then a domain event is published and the
// query-side cache is invalidated.

export const createLineCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { site_id, name, status } = req.body;
  if (!site_id || !name) {
    res.status(400).json({ error: 'site_id и name обязательны' });
    return;
  }

  const line = await AssemblyLine.create({
    site_id,
    name,
    status: status || 'idle',
    created_by: req.user!.id,
  });

  await publish('NodeCreated', line._id.toString(), {
    nodeId: line._id.toString(),
    name: line.name,
    type: 'line',
    lineId: line._id.toString(),
    userId: req.user!.id,
  });

  cacheInvalidate(['lines', 'stats']);

  logger.info(`Command: line created ${line._id}`, { action: 'command_line_created', lineId: line._id.toString() });
  res.status(201).json({ _id: line._id, accepted: true, message: 'Линия создана.' });
};

export const changeLineStatusCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!status) { res.status(400).json({ error: 'status обязателен' }); return; }

  const line = await AssemblyLine.findById(req.params.id);
  if (!line) { res.status(404).json({ error: 'Линия не найдена' }); return; }

  // 6.1.2 — owner check from token
  const ownerId = typeof line.created_by === 'object' && (line.created_by as any)._id
    ? (line.created_by as any)._id.toString() : line.created_by.toString();
  if (req.user!.role !== 'admin' && ownerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа к этой линии' }); return;
  }

  const oldStatus = line.status;
  line.status = status;
  await line.save();

  await publish('NodeStatusChanged', line._id.toString(), {
    nodeId: line._id.toString(),
    oldStatus,
    newStatus: status,
    userId: req.user!.id,
  });

  cacheInvalidate(['lines', 'stats', `line:${line._id.toString()}`]);

  logger.info(`Command: line status ${line._id} ${oldStatus} -> ${status}`, {
    action: 'command_line_status_changed',
    lineId: line._id.toString(),
  });
  res.json({ accepted: true, message: 'Статус линии изменён.' });
};
