import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { Command, TechNode, Alert } from '../models';
import { emitNodeStatus } from '../socket';
import { pauseNode, resumeNode } from '../services/simulator';
import logger from '../logger';
import { publish } from '../events/eventBus';
import { cacheInvalidate } from '../cache';
import { recordCommand, recordQueueEvent } from '../metrics';

interface CommandJobData {
  commandId: string;
  nodeId: string;
  actionType: string;
  parameters: Record<string, any>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processCommand(job: Job<CommandJobData>): Promise<{ status: string; result?: any }> {
  const { commandId, nodeId, actionType, parameters } = job.data;
  const action = actionType.toLowerCase();
  const startedAt = Date.now();

  logger.info(`Worker processing command ${commandId}`, {
    action: 'worker_processing',
    jobId: job.id,
    commandId,
    actionType: action,
    nodeId,
  });

  // Mark as executing
  await Command.findByIdAndUpdate(commandId, { status: 'executing' });
  await job.updateProgress(10);

  try {
    if (action === 'restart') {
      pauseNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'offline' });
      emitNodeStatus(nodeId, 'offline');
      await job.updateProgress(30);

      await sleep(3000);

      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      resumeNode(nodeId);
      await job.updateProgress(90);

    } else if (action === 'emergency_stop' || action === 'stop') {
      pauseNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'offline' });
      emitNodeStatus(nodeId, 'offline');
      await job.updateProgress(90);

    } else if (action === 'start') {
      resumeNode(nodeId);
      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await job.updateProgress(90);

    } else if (action === 'calibrate') {
      await TechNode.findByIdAndUpdate(nodeId, { status: 'warning' });
      emitNodeStatus(nodeId, 'warning');
      await job.updateProgress(30);

      await sleep(4000);

      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await job.updateProgress(90);

    } else if (action === 'set_parameter') {
      if (parameters.param && parameters.value !== undefined) {
        const node = await TechNode.findById(nodeId);
        if (node) {
          const param = node.parameters.find(p => p.name === parameters.param);
          if (param) {
            if (parameters.min !== undefined) param.min_value = parameters.min;
            if (parameters.max !== undefined) param.max_value = parameters.max;
            await node.save();
          }
        }
      }
      await job.updateProgress(90);

    } else if (action === 'diagnostics') {
      await TechNode.findByIdAndUpdate(nodeId, { status: 'warning' });
      emitNodeStatus(nodeId, 'warning');
      await job.updateProgress(30);

      await sleep(2000);

      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await job.updateProgress(80);

      const diagnosticsResult = {
        cpu_load: `${(Math.random() * 30 + 10).toFixed(1)}%`,
        memory_usage: `${(Math.random() * 40 + 20).toFixed(1)}%`,
        uptime_hours: Math.floor(Math.random() * 720 + 24),
        firmware: 'v3.2.1',
        status: 'healthy',
      };

      await Command.findByIdAndUpdate(commandId, {
        parameters: { ...parameters, result: diagnosticsResult },
      });
      await job.updateProgress(90);

      return { status: 'completed', result: diagnosticsResult };

    } else if (action === 'reset_alerts') {
      await Alert.updateMany(
        { node_id: nodeId, status: { $in: ['active', 'acknowledged'] } },
        { status: 'resolved', resolved_at: new Date() }
      );
      await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
      emitNodeStatus(nodeId, 'online');
      await job.updateProgress(90);

    } else {
      await sleep(1000);
      await job.updateProgress(90);
    }

    // Mark as completed
    await Command.findByIdAndUpdate(commandId, { status: 'completed', executed_at: new Date() });
    await job.updateProgress(100);

    // Publish domain events — read model updated asynchronously (eventual consistency)
    const finalNode = await TechNode.findById(nodeId);
    if (finalNode) {
      await publish('NodeStatusChanged', nodeId, {
        nodeId,
        oldStatus: 'unknown',
        newStatus: finalNode.status,
      });
    }
    await publish('CommandExecuted', commandId, {
      commandId,
      nodeId,
      actionType: action,
      status: 'completed',
    });

    // Cache invalidation — read-side cache must drop stale node data after a command
    cacheInvalidate(['nodes', 'stats', `node:${nodeId}`]);

    recordCommand(action, Date.now() - startedAt, false);
    recordQueueEvent('completed');

    logger.info(`Command ${commandId} completed successfully`, {
      action: 'worker_completed',
      jobId: job.id,
      commandId,
      actionType: action,
    });

    return { status: 'completed' };

  } catch (err: any) {
    recordCommand(action, Date.now() - startedAt, true);
    recordQueueEvent('failed');
    logger.error(`Command ${commandId} failed: ${err.message}`, {
      action: 'worker_failed',
      jobId: job.id,
      commandId,
      error: err.message,
    });
    await Command.findByIdAndUpdate(commandId, { status: 'failed', executed_at: new Date() });
    throw err;
  }
}

let worker: Worker | null = null;

export function startWorker(): Worker {
  worker = new Worker('command-execution', processCommand, {
    connection: {
      host: config.redisHost,
      port: config.redisPort,
    },
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`, { action: 'job_completed', jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`, { action: 'job_failed', jobId: job?.id, error: err.message });
  });

  logger.info('BullMQ command worker started', { action: 'worker_started' });
  return worker;
}

export function stopWorker(): Promise<void> {
  if (worker) {
    return worker.close();
  }
  return Promise.resolve();
}
