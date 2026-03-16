import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAlert extends Document {
  node_id: Types.ObjectId;
  param_id: Types.ObjectId;
  severity: string;
  message: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

const AlertSchema = new Schema<IAlert>({
  node_id: { type: Schema.Types.ObjectId, ref: 'TechNode', required: true },
  param_id: { type: Schema.Types.ObjectId, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  resolved_at: { type: Date, default: null },
});

AlertSchema.index({ node_id: 1, status: 1 });
AlertSchema.index({ created_at: -1 });

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
