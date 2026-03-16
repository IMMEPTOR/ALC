import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICommand extends Document {
  node_id: Types.ObjectId;
  user_id: Types.ObjectId;
  action_type: string;
  parameters: Record<string, any>;
  status: string;
  created_at: Date;
  executed_at: Date | null;
}

const CommandSchema = new Schema<ICommand>({
  node_id: { type: Schema.Types.ObjectId, ref: 'TechNode', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action_type: { type: String, required: true },
  parameters: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'executing', 'completed', 'failed'], default: 'pending' },
  created_at: { type: Date, default: Date.now },
  executed_at: { type: Date, default: null },
});

CommandSchema.index({ node_id: 1, created_at: -1 });

export const Command = mongoose.model<ICommand>('Command', CommandSchema);
