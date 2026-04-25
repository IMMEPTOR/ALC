import { Worker, Job } from 'bullmq';
import { config } from '../../config';
import { DomainEvent, NodeStatusChangedPayload, NodeCreatedPayload, AlertCreatedPayload, CommandExecutedPayload } from '../domainEvents';
import { updateNodeStatusInReadModel, upsertNodeReadModel, incrementAlertsCount, setLastCommand } from '../../readmodels/nodeReadModel';
import { TechNode, AssemblyLine, ProductionSite, User } from '../../models';
import logger from '../../logger';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleNodeStatusChanged(event: DomainEvent<NodeStatusChangedPayload>): Promise<void> {
  // Simulate real-world delay — eventual consistency (4.4)
  await sleep(500);
  await updateNodeStatusInReadModel(event.payload.nodeId, event.payload.newStatus);
  logger.info(`Read model updated: node ${event.payload.nodeId} status -> ${event.payload.newStatus}`, {
    action: 'read_model_updated',
    eventType: event.type,
  });
}

async function handleNodeCreated(event: DomainEvent<NodeCreatedPayload>): Promise<void> {
  await sleep(500);
  const node = await TechNode.findById(event.payload.nodeId);
  if (!node) throw new Error(`Node ${event.payload.nodeId} not found`);
  const line = await AssemblyLine.findById(node.line_id);
  const site = line ? await ProductionSite.findById(line.site_id) : null;
  const owner = await User.findById(node.created_by);

  await upsertNodeReadModel({
    node_id: node._id.toString(),
    name: node.name,
    type: node.type,
    ip_address: node.ip_address,
    status: node.status,
    line_id: line?._id?.toString() || '',
    line_name: line?.name || '',
    site_id: site?._id?.toString() || '',
    site_name: site?.name || '',
    site_location: site?.location || '',
    owner_id: owner?._id?.toString() || '',
    owner_username: owner?.username || '',
    active_alerts_count: 0,
  });

  logger.info(`Read model: node created ${event.payload.nodeId}`, {
    action: 'read_model_node_created',
    eventType: event.type,
  });
}

async function handleAlertCreated(event: DomainEvent<AlertCreatedPayload>): Promise<void> {
  await sleep(500);
  await incrementAlertsCount(event.payload.nodeId, 1);
  logger.info(`Read model: alerts count incremented for node ${event.payload.nodeId}`, {
    action: 'read_model_alert_added',
    eventType: event.type,
  });
}

async function handleCommandExecuted(event: DomainEvent<CommandExecutedPayload>): Promise<void> {
  await sleep(500);
  await setLastCommand(event.payload.nodeId, event.payload.actionType);
  logger.info(`Read model: last command set for node ${event.payload.nodeId}`, {
    action: 'read_model_command_executed',
    eventType: event.type,
  });
}

async function processEvent(job: Job<DomainEvent>): Promise<void> {
  const event = job.data;
  logger.info(`Processing event ${event.type}`, { action: 'event_processing', eventType: event.type, jobId: job.id });

  try {
    switch (event.type) {
      case 'NodeStatusChanged':
        await handleNodeStatusChanged(event as DomainEvent<NodeStatusChangedPayload>);
        break;
      case 'NodeCreated':
        await handleNodeCreated(event as DomainEvent<NodeCreatedPayload>);
        break;
      case 'AlertCreated':
        await handleAlertCreated(event as DomainEvent<AlertCreatedPayload>);
        break;
      case 'CommandExecuted':
        await handleCommandExecuted(event as DomainEvent<CommandExecutedPayload>);
        break;
      default:
        logger.warn(`Unknown event type: ${event.type}`);
    }
  } catch (err: any) {
    logger.error(`Event handler failed for ${event.type}: ${err.message}`, {
      action: 'event_handler_failed',
      eventType: event.type,
      error: err.message,
      attemptsMade: job.attemptsMade,
    });
    throw err;
  }
}

let eventWorker: Worker | null = null;

export function startEventWorker(): Worker {
  eventWorker = new Worker('domain-events', processEvent, {
    connection: { host: config.redisHost, port: config.redisPort },
    concurrency: 3,
  });

  eventWorker.on('completed', (job) => {
    logger.info(`Event job ${job.id} completed`, { action: 'event_job_completed' });
  });

  eventWorker.on('failed', (job, err) => {
    logger.error(`Event job ${job?.id} failed: ${err.message}`, {
      action: 'event_job_failed',
      attemptsMade: job?.attemptsMade,
    });
  });

  logger.info('Domain event worker started');
  return eventWorker;
}

export function stopEventWorker(): Promise<void> {
  if (eventWorker) return eventWorker.close();
  return Promise.resolve();
}
