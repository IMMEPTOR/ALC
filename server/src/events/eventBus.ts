import { Queue } from 'bullmq';
import { config } from '../config';
import { DomainEvent, DomainEventType } from './domainEvents';
import logger from '../logger';

let eventQueue: Queue | null = null;

export function initEventBus(): Queue {
  eventQueue = new Queue('domain-events', {
    connection: { host: config.redisHost, port: config.redisPort },
  });
  logger.info('Domain events bus initialized');
  return eventQueue;
}

export function getEventQueue(): Queue {
  if (!eventQueue) throw new Error('Event bus not initialized');
  return eventQueue;
}

export async function publish<T>(type: DomainEventType, aggregateId: string, payload: T): Promise<void> {
  const event: DomainEvent<T> = {
    type,
    aggregateId,
    payload,
    occurredAt: new Date().toISOString(),
  };
  const queue = getEventQueue();
  await queue.add(type, event, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
  logger.info(`Event published: ${type}`, { action: 'event_published', eventType: type, aggregateId });
}
