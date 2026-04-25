import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProductionSite extends Document {
  name: string;
  location: string;
  created_by: Types.ObjectId;
  created_at: Date;
}

const ProductionSiteSchema = new Schema<IProductionSite>({
  name: { type: String, required: true },
  location: { type: String, required: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
});

export const ProductionSite = mongoose.model<IProductionSite>('ProductionSite', ProductionSiteSchema);
