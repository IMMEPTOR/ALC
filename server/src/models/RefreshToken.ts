import mongoose, { Schema, Document, Types } from 'mongoose';

// 6.2.2 — refresh token storage. Stored as hashed token to allow revocation
// (delete row to revoke). TTL index automatically purges expired tokens.
export interface IRefreshToken extends Document {
  user_id: Types.ObjectId;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked: boolean;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token_hash: { type: String, required: true, unique: true, index: true },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
});

RefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
