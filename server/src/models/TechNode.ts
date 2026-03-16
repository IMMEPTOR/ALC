import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IParameter {
  param_id: Types.ObjectId;
  name: string;
  unit: string;
  min_value: number;
  max_value: number;
  update_interval_sec: number;
}

export interface ITechNode extends Document {
  line_id: Types.ObjectId;
  name: string;
  type: string;
  status: string;
  ip_address: string;
  created_at: Date;
  parameters: IParameter[];
}

const ParameterSchema = new Schema<IParameter>({
  param_id: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  name: { type: String, required: true },
  unit: { type: String, required: true },
  min_value: { type: Number, required: true },
  max_value: { type: Number, required: true },
  update_interval_sec: { type: Number, default: 10 },
}, { _id: false });

const TechNodeSchema = new Schema<ITechNode>({
  line_id: { type: Schema.Types.ObjectId, ref: 'AssemblyLine', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline', 'warning', 'critical'], default: 'online' },
  ip_address: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  parameters: [ParameterSchema],
});

export const TechNode = mongoose.model<ITechNode>('TechNode', TechNodeSchema);
