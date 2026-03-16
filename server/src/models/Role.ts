import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  permissions: string[];
  created_at: Date;
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: String }],
  created_at: { type: Date, default: Date.now },
});

export const Role = mongoose.model<IRole>('Role', RoleSchema);
