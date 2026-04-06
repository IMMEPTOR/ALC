import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, Session } from '../models';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, password, role_id } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    return;
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    res.status(409).json({ error: 'Пользователь уже существует' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    username,
    password_hash,
    role_id,
    is_active: true
  });

  res.status(201).json({ id: user._id, username: user.username });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    return;
  }

  const user = await User.findOne({ username }).populate('role_id');
  if (!user) {
    res.status(401).json({ error: 'Неверные учетные данные' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Неверные учетные данные' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Учетная запись деактивирована' });
    return;
  }

  const role = user.role_id as any;
  const token = jwt.sign(
    { 
      user_id: user._id, 
      role: role ? role.name : undefined 
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Session.create({
    user_id: user._id,
    jwt_token: token,
    expires_at: expiresAt,
  });

  res.json({
    access_token: token,
    token_type: "bearer"
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    await Session.deleteOne({ jwt_token: token });
  }
  res.json({ message: 'Выход выполнен' });
};