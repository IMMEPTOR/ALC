import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  user_id: Types.ObjectId;
  jwt_token: string;
  created_at: Date;
  expires_at: Date;
}

const SessionSchema = new Schema<ISession>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jwt_token: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
});

SessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
