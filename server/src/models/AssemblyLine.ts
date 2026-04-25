import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAssemblyLine extends Document {
  site_id: Types.ObjectId;
  name: string;
  status: string;
  created_by: Types.ObjectId;
  created_at: Date;
}

const AssemblyLineSchema = new Schema<IAssemblyLine>({
  site_id: { type: Schema.Types.ObjectId, ref: 'ProductionSite', required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
});

export const AssemblyLine = mongoose.model<IAssemblyLine>('AssemblyLine', AssemblyLineSchema);
