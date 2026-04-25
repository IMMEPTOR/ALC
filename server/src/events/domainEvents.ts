export type DomainEventType =
  | 'NodeStatusChanged'
  | 'NodeCreated'
  | 'AlertCreated'
  | 'CommandExecuted';

export interface DomainEvent<T = any> {
  type: DomainEventType;
  aggregateId: string;
  payload: T;
  occurredAt: string;
}

export interface NodeStatusChangedPayload {
  nodeId: string;
  oldStatus: string;
  newStatus: string;
  userId?: string;
}

export interface NodeCreatedPayload {
  nodeId: string;
  name: string;
  type: string;
  lineId: string;
  userId: string;
}

export interface AlertCreatedPayload {
  alertId: string;
  nodeId: string;
  severity: string;
  message: string;
}

export interface CommandExecutedPayload {
  commandId: string;
  nodeId: string;
  actionType: string;
  status: 'completed' | 'failed';
}
