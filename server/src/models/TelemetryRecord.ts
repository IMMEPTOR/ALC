import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITelemetryRecord extends Document {
  node_id: Types.ObjectId;
  param_id: Types.ObjectId;
  value: number;
  timestamp: Date;
  quality_flag: string;
}

const TelemetryRecordSchema = new Schema<ITelemetryRecord>({
  node_id: { type: Schema.Types.ObjectId, ref: 'TechNode', required: true },
  param_id: { type: Schema.Types.ObjectId, required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  quality_flag: { type: String, enum: ['good', 'uncertain', 'bad'], default: 'good' },
});

TelemetryRecordSchema.index({ node_id: 1, timestamp: -1 });
TelemetryRecordSchema.index({ node_id: 1, param_id: 1, timestamp: -1 });

export const TelemetryRecord = mongoose.model<ITelemetryRecord>('TelemetryRecord', TelemetryRecordSchema);
