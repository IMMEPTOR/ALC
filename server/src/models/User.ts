import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  role_id: Types.ObjectId;
  username: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
}

const UserSchema = new Schema<IUser>({
  role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', UserSchema);
