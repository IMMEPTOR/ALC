import { Request, Response } from 'express';
import { TelemetryRecord, TechNode, Alert } from '../models';

export const getTelemetry = async (req: Request, res: Response): Promise<void> => {
  const { node_id, param_id, from, to, limit } = req.query;
  const filter: any = {};
  if (node_id) filter.node_id = node_id;
  if (param_id) filter.param_id = param_id;
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from as string);
    if (to) filter.timestamp.$lte = new Date(to as string);
  }

  const records = await TelemetryRecord.find(filter)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit as string) || 100);
  res.json(records);
};

export const getLatestTelemetry = async (req: Request, res: Response): Promise<void> => {
  const { node_id } = req.params;
  const node = await TechNode.findById(node_id);
  if (!node) { res.status(404).json({ error: 'Узел не найден' }); return; }

  const latest = await Promise.all(
    node.parameters.map(async (param) => {
      const record = await TelemetryRecord.findOne({ node_id, param_id: param.param_id })
        .sort({ timestamp: -1 });
      return {
        param_id: param.param_id,
        name: param.name,
        unit: param.unit,
        min_value: param.min_value,
        max_value: param.max_value,
        value: record?.value ?? null,
        timestamp: record?.timestamp ?? null,
        quality_flag: record?.quality_flag ?? null,
      };
    })
  );
  res.json(latest);
};

export const createTelemetry = async (req: Request, res: Response): Promise<void> => {
  const { node_id, param_id, value, quality_flag } = req.body;
  if (!node_id || !param_id || value === undefined) {
    res.status(400).json({ error: 'node_id, param_id и value обязательны' });
    return;
  }

  const record = await TelemetryRecord.create({ node_id, param_id, value, quality_flag });

  // Check thresholds and create alert if needed
  const node = await TechNode.findById(node_id);
  if (node) {
    const param = node.parameters.find(p => p.param_id.toString() === param_id);
    if (param && (value < param.min_value || value > param.max_value)) {
      const severity = Math.abs(value - (value < param.min_value ? param.min_value : param.max_value)) >
        (param.max_value - param.min_value) * 0.2 ? 'critical' : 'warning';

      await Alert.create({
        node_id,
        param_id,
        severity,
        message: `Параметр "${param.name}" = ${value} ${param.unit} выходит за пределы [${param.min_value}, ${param.max_value}]`,
      });

      if (severity === 'critical' && node.status !== 'critical') {
        await TechNode.findByIdAndUpdate(node_id, { status: 'critical' });
      } else if (severity === 'warning' && node.status === 'online') {
        await TechNode.findByIdAndUpdate(node_id, { status: 'warning' });
      }
    }
  }

  res.status(201).json(record);
};
