import { Queue } from 'bullmq';
import { config } from '../config';

let commandQueue: Queue;

export function initCommandQueue(): Queue {
  commandQueue = new Queue('command-execution', {
    connection: {
      host: config.redisHost,
      port: config.redisPort,
    },
  });
  return commandQueue;
}

export function getCommandQueue(): Queue {
  if (!commandQueue) {
    throw new Error('Command queue not initialized. Call initCommandQueue() first.');
  }
  return commandQueue;
}
