import { Request, Response } from 'express';
import { Command, TechNode } from '../models';
import { AuthRequest } from '../middleware/auth';
import { emitNodeStatus } from '../socket';
import { pauseNode, resumeNode } from '../services/simulator';

export const getCommands = async (req: Request, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.node_id) filter.node_id = req.query.node_id;
  if (req.query.status) filter.status = req.query.status;

  const commands = await Command.find(filter)
    .populate('node_id', 'name type')
    .populate('user_id', 'username')
    .sort({ created_at: -1 })
    .limit(parseInt(req.query.limit as string) || 50);
  res.json(commands);
};

/**
 * Simulate command execution with realistic behavior depending on action_type.
 */
async function simulateExecution(commandId: string, nodeId: string, actionType: string, params: any) {
  const action = actionType.toLowerCase();

  try {
    // Mark as executing
    await Command.findByIdAndUpdate(commandId, { status: 'executing' });

    if (action === 'restart') {
      // Phase 1: node goes offline (shutting down)
      pauseNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'offline' });
      emitNodeStatus(nodeId, 'offline');

      // Phase 2: after 3s, come back online
      setTimeout(async () => {
        await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
        emitNodeStatus(nodeId, 'online');
        resumeNode(nodeId);
        await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });
      }, 3000);

    } else if (action === 'emergency_stop' || action === 'stop') {
      // Node goes offline and stays offline until manually restarted
      pauseNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'offline' });
      emitNodeStatus(nodeId, 'offline');
      await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });

    } else if (action === 'start') {
      // Bring an offline node back online
      resumeNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });

    } else if (action === 'calibrate') {
      // Phase 1: node goes to warning during calibration
      await TechNode.findByIdAndUpdate(nodeId, { status: 'warning' });
      emitNodeStatus(nodeId, 'warning');

      // Phase 2: after 4s, calibration complete, back to online
      setTimeout(async () => {
        await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
        emitNodeStatus(nodeId, 'online');
        await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });
      }, 4000);

    } else if (action === 'set_parameter') {
      // Update parameter range on the node
      if (params.param && params.value !== undefined) {
        const node = await TechNode.findById(nodeId);
        if (node) {
          const param = node.parameters.find(p => p.name === params.param);
          if (param) {
            if (params.min !== undefined) param.min_value = params.min;
            if (params.max !== undefined) param.max_value = params.max;
            await node.save();
          }
        }
      }
      await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });

    } else if (action === 'diagnostics') {
      // Simulate diagnostics running (2s), node briefly goes to warning
      await TechNode.findByIdAndUpdate(nodeId, { status: 'warning' });
      emitNodeStatus(nodeId, 'warning');

      setTimeout(async () => {
        await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
        emitNodeStatus(nodeId, 'online');
        await Command.findByIdAndUpdate(commandId, {
          status: 'completed',
          executed_at: new Date(),
          parameters: {
            ...params,
            result: {
              cpu_load: `${(Math.random() * 30 + 10).toFixed(1)}%`,
              memory_usage: `${(Math.random() * 40 + 20).toFixed(1)}%`,
              uptime_hours: Math.floor(Math.random() * 720 + 24),
              firmware: 'v3.2.1',
              status: 'healthy',
            },
          },
        });
      }, 2000);

    } else if (action === 'reset_alerts') {
      // Clear active alerts for this node and restore status
      const { Alert } = require('../models');
      await Alert.updateMany(
        { node_id: nodeId, status: { $in: ['active', 'acknowledged'] } },
        { status: 'resolved', resolved_at: new Date() }
      );
      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });

    } else {
      // Unknown command — just mark completed after 1s
      setTimeout(async () => {
        await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });
      }, 1000);
    }
  } catch (err) {
    console.error('Command execution error:', err);
    await Command.findByIdAndUpdate(commandId, { status: 'failed', executed_at: new Date() });
  }
}

export const createCommand = async (req: AuthRequest, res: Response): Promise<void> => {
  const { node_id, action_type, parameters } = req.body;
  if (!node_id || !action_type) {
    res.status(400).json({ error: 'node_id и action_type обязательны' });
    return;
  }

  const command = await Command.create({
    node_id,
    user_id: req.user!.id,
    action_type,
    parameters: parameters || {},
  });

  // Start async simulation
  simulateExecution(command._id.toString(), node_id, action_type, parameters || {});

  res.status(201).json(command);
};

export const getCommandById = async (req: Request, res: Response): Promise<void> => {
  const command = await Command.findById(req.params.id)
    .populate('node_id', 'name type')
    .populate('user_id', 'username');
  if (!command) { res.status(404).json({ error: 'Команда не найдена' }); return; }
  res.json(command);
};
