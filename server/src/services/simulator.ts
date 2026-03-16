import { TechNode, TelemetryRecord, Alert } from '../models';
import { emitTelemetryUpdate, emitAlert, emitNodeStatus } from '../socket';

// Store last values for smooth drift simulation
const lastValues: Map<string, number> = new Map();

// Nodes currently "restarting" or "stopped" — skip telemetry generation
const pausedNodes: Set<string> = new Set();

export const pauseNode = (nodeId: string) => pausedNodes.add(nodeId);
export const resumeNode = (nodeId: string) => pausedNodes.delete(nodeId);
export const isNodePaused = (nodeId: string) => pausedNodes.has(nodeId);

/**
 * Generate a value that drifts smoothly from the last known value,
 * mostly staying within [min, max] but occasionally drifting outside.
 */
function generateValue(key: string, min: number, max: number): number {
  const range = max - min;
  const mid = (min + max) / 2;
  const last = lastValues.get(key) ?? mid;

  // Random walk: small step relative to range
  const step = (Math.random() - 0.5) * range * 0.15;
  let next = last + step;

  // Soft pull towards center (mean-reversion) so values don't run away
  const pullStrength = 0.05;
  next += (mid - next) * pullStrength;

  // Occasionally spike outside range (5% chance)
  if (Math.random() < 0.05) {
    const spike = (Math.random() - 0.5) * range * 0.6;
    next += spike;
  }

  // Clamp to reasonable bounds (allow 20% overshoot for alerts)
  next = Math.max(min - range * 0.2, Math.min(max + range * 0.2, next));

  lastValues.set(key, next);
  return parseFloat(next.toFixed(2));
}

/**
 * Process a single telemetry reading: save to DB, check thresholds, emit via socket.
 */
async function processTelemetry(nodeId: string, param: any, value: number) {
  const qualityFlag = (value >= param.min_value && value <= param.max_value) ? 'good' :
    (Math.abs(value - (value < param.min_value ? param.min_value : param.max_value)) >
      (param.max_value - param.min_value) * 0.2) ? 'bad' : 'uncertain';

  const record = await TelemetryRecord.create({
    node_id: nodeId,
    param_id: param.param_id,
    value,
    quality_flag: qualityFlag,
  });

  // Emit to subscribed clients
  emitTelemetryUpdate(nodeId, {
    node_id: nodeId,
    param_id: param.param_id.toString(),
    value,
    timestamp: record.timestamp,
    quality_flag: qualityFlag,
    name: param.name,
    unit: param.unit,
  });

  // Check thresholds → create alerts
  if (value < param.min_value || value > param.max_value) {
    const overshoot = Math.abs(value - (value < param.min_value ? param.min_value : param.max_value));
    const severity = overshoot > (param.max_value - param.min_value) * 0.2 ? 'critical' : 'warning';

    const alert = await Alert.create({
      node_id: nodeId,
      param_id: param.param_id,
      severity,
      message: `Параметр "${param.name}" = ${value} ${param.unit} выходит за пределы [${param.min_value}, ${param.max_value}]`,
    });

    emitAlert(alert);

    // Update node status
    const node = await TechNode.findById(nodeId);
    if (node) {
      if (severity === 'critical' && node.status !== 'critical') {
        await TechNode.findByIdAndUpdate(nodeId, { status: 'critical' });
        emitNodeStatus(nodeId, 'critical');
      } else if (severity === 'warning' && node.status === 'online') {
        await TechNode.findByIdAndUpdate(nodeId, { status: 'warning' });
        emitNodeStatus(nodeId, 'warning');
      }
    }
  }
}

/**
 * Main tick: generate telemetry for all online/warning nodes.
 */
async function tick() {
  try {
    const nodes = await TechNode.find({ status: { $in: ['online', 'warning', 'critical'] } });

    for (const node of nodes) {
      const nodeId = node._id.toString();
      if (pausedNodes.has(nodeId)) continue;

      for (const param of node.parameters) {
        const key = `${nodeId}:${param.param_id}`;
        const value = generateValue(key, param.min_value, param.max_value);
        await processTelemetry(nodeId, param, value);
      }

      // If node was warning/critical but all values are now in range, restore to online
      if (node.status === 'warning' || node.status === 'critical') {
        const allInRange = node.parameters.every(p => {
          const key = `${nodeId}:${p.param_id}`;
          const v = lastValues.get(key);
          return v !== undefined && v >= p.min_value && v <= p.max_value;
        });
        if (allInRange) {
          await TechNode.findByIdAndUpdate(nodeId, { status: 'online' });
          emitNodeStatus(nodeId, 'online');
        }
      }
    }
  } catch (err) {
    console.error('Simulator tick error:', err);
  }
}

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the telemetry simulator. Generates data every `intervalMs` milliseconds.
 */
export function startSimulator(intervalMs = 4000) {
  if (intervalId) return;
  console.log(`Telemetry simulator started (interval: ${intervalMs}ms)`);
  // Initial tick
  tick();
  intervalId = setInterval(tick, intervalMs);
}

export function stopSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Telemetry simulator stopped');
  }
}
