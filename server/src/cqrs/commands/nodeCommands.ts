import { Response } from 'express';
import { TechNode } from '../../models';
import { AuthRequest } from '../../middleware/auth';
import { publish } from '../../events/eventBus';
import { cacheInvalidate } from '../../cache';
import logger from '../../logger';

// CQRS Command side — mutations only, writes to write model.
// Publishes domain events after successful writes.
// Invalidates query-side cache by tag (требование на 5 — кэш + инвалидация).

export const createNodeCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { line_id, name, type, ip_address, parameters } = req.body;
  if (!line_id || !name || !type || !ip_address) {
    res.status(400).json({ error: 'line_id, name, type и ip_address обязательны' });
    return;
  }
  const node = await TechNode.create({
    line_id,
    name,
    type,
    ip_address,
    parameters: parameters || [],
    created_by: req.user!.id,
  });

  await publish('NodeCreated', node._id.toString(), {
    nodeId: node._id.toString(),
    name: node.name,
    type: node.type,
    lineId: line_id,
    userId: req.user!.id,
  });

  cacheInvalidate(['nodes', 'stats']);

  logger.info(`Command: node created ${node._id}`, { action: 'command_node_created', nodeId: node._id.toString() });
  res.status(201).json({ _id: node._id, accepted: true, message: 'Узел создан. Read model будет обновлена асинхронно.' });
};

export const changeNodeStatusCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!status) { res.status(400).json({ error: 'status обязателен' }); return; }

  const node = await TechNode.findById(req.params.id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }

  const oldStatus = node.status;
  node.status = status;
  await node.save();

  await publish('NodeStatusChanged', node._id.toString(), {
    nodeId: node._id.toString(),
    oldStatus,
    newStatus: status,
    userId: req.user!.id,
  });

  cacheInvalidate(['nodes', 'stats', `node:${node._id.toString()}`]);

  logger.info(`Command: status changed ${node._id} ${oldStatus} -> ${status}`, {
    action: 'command_status_changed',
    nodeId: node._id.toString(),
  });
  res.json({ accepted: true, message: 'Статус изменён. Read model будет обновлена асинхронно.' });
};

export const deleteNodeCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const node = await TechNode.findById(req.params.id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }
  const ownerId = typeof node.created_by === 'object' && (node.created_by as any)._id
    ? (node.created_by as any)._id.toString() : node.created_by.toString();
  // 6.1.2 — owner check via token id, not request body
  if (req.user!.role !== 'admin' && ownerId !== req.user!.id) {
    res.status(403).json({ error: 'Нет доступа' }); return;
  }
  await TechNode.findByIdAndDelete(req.params.id);

  cacheInvalidate(['nodes', 'stats', `node:${req.params.id}`]);

  res.json({ accepted: true, message: 'Узел удалён' });
};
