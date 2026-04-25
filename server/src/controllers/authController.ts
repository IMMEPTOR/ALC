import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { User, Session, RefreshToken } from '../models';
import { AuthRequest } from '../middleware/auth';
import logger from '../logger';

// 6.2 — short-lived access token + long-lived refresh token.
// Access token: 15 min (config.jwtExpiresIn)
// Refresh token: 7 days (config.jwtRefreshExpiresIn), rotated on refresh.

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseDurationToMs(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

async function issueTokenPair(user: any, role: any) {
  const accessToken = jwt.sign(
    { user_id: user._id, role: role ? role.name : undefined, type: 'access' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );

  const refreshToken = jwt.sign(
    { user_id: user._id, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn as any }
  );

  const refreshExpires = new Date(Date.now() + parseDurationToMs(config.jwtRefreshExpiresIn));
  await RefreshToken.create({
    user_id: user._id,
    token_hash: hashToken(refreshToken),
    expires_at: refreshExpires,
  });

  return { accessToken, refreshToken, refreshExpires };
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, password, role_id } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    res.status(409).json({ error: 'Пользователь уже существует' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password_hash, role_id, is_active: true });

  logger.info(`User registered: ${username}`, { action: 'register', userId: user._id.toString() });
  res.status(201).json({ id: user._id, username: user.username });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).populate('role_id');
  if (!user) {
    logger.warn(`Failed login attempt: user "${username}" not found`, { action: 'login_failed', username });
    res.status(401).json({ error: 'Неверные учетные данные' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    logger.warn(`Failed login attempt: wrong password for "${username}"`, { action: 'login_failed', username });
    res.status(401).json({ error: 'Неверные учетные данные' });
    return;
  }

  if (!user.is_active) {
    logger.warn(`Deactivated user login attempt: "${username}"`, { action: 'login_blocked', username });
    res.status(403).json({ error: 'Учетная запись деактивирована' });
    return;
  }

  const role = user.role_id as any;
  const { accessToken, refreshToken, refreshExpires } = await issueTokenPair(user, role);

  // Keep legacy session record for compatibility with existing /logout flow
  await Session.create({
    user_id: user._id,
    jwt_token: accessToken,
    expires_at: new Date(Date.now() + parseDurationToMs(config.jwtExpiresIn)),
  });

  logger.info(`User logged in: ${username}`, { action: 'login', userId: user._id.toString(), role: role?.name });

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: Math.floor(parseDurationToMs(config.jwtExpiresIn) / 1000),
    refresh_expires_at: refreshExpires.toISOString(),
  });
};

// 6.2.2 — refresh endpoint. Validates refresh token, rotates it (revokes old, issues new pair).
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token обязателен' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(refresh_token, config.jwtRefreshSecret);
  } catch {
    res.status(401).json({ error: 'Недействительный refresh token' });
    return;
  }

  if (decoded.type !== 'refresh') {
    res.status(401).json({ error: 'Неверный тип токена' });
    return;
  }

  const stored = await RefreshToken.findOne({ token_hash: hashToken(refresh_token) });
  if (!stored || stored.revoked || stored.expires_at < new Date()) {
    res.status(401).json({ error: 'Refresh token отозван или истёк' });
    return;
  }

  const user = await User.findById(decoded.user_id).populate('role_id');
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    return;
  }

  // Rotate: revoke old, issue new pair
  stored.revoked = true;
  await stored.save();

  const role = user.role_id as any;
  const pair = await issueTokenPair(user, role);

  logger.info(`Refresh token rotated for user ${user.username}`, { action: 'token_refresh', userId: user._id.toString() });

  res.json({
    access_token: pair.accessToken,
    refresh_token: pair.refreshToken,
    token_type: 'bearer',
    expires_in: Math.floor(parseDurationToMs(config.jwtExpiresIn) / 1000),
    refresh_expires_at: pair.refreshExpires.toISOString(),
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await Session.deleteOne({ jwt_token: token });

  // Also revoke any refresh tokens for this user (best-effort all-device logout)
  if (req.user?.id) {
    await RefreshToken.updateMany({ user_id: req.user.id, revoked: false }, { revoked: true });
  }
  logger.info(`User logged out: ${req.user?.username}`, { action: 'logout', userId: req.user?.id });
  res.json({ message: 'Выход выполнен' });
};

// 6.2 — list active refresh sessions of the calling user.
// Admin can pass ?user_id=... to inspect another user's sessions.
// We never return the refresh token itself, only metadata + hash prefix.
export const listSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  const targetUserId = (req.query.user_id as string) || req.user!.id;
  if (targetUserId !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Только admin может смотреть чужие сессии' });
    return;
  }

  const sessions = await RefreshToken.find({
    user_id: targetUserId,
    revoked: false,
    expires_at: { $gt: new Date() },
  }).sort({ created_at: -1 }).lean();

  res.json({
    count: sessions.length,
    sessions: sessions.map(s => ({
      id: s._id,
      created_at: s.created_at,
      expires_at: s.expires_at,
      token_hash_prefix: s.token_hash.slice(0, 12),
    })),
  });
};

// Revoke a specific refresh token (a single device logout).
export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await RefreshToken.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Сессия не найдена' }); return; }

  // 6.1.2 — owner check via token, not via body
  if (session.user_id.toString() !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Нет доступа к этой сессии' });
    return;
  }

  session.revoked = true;
  await session.save();
  logger.info(`Refresh session revoked: ${session._id}`, {
    action: 'session_revoked',
    sessionId: session._id.toString(),
    userId: req.user!.id,
  });
  res.json({ revoked: true });
};
