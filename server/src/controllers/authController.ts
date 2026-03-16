import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, Session, Role } from '../models';
import { AuthRequest } from '../middleware/auth';

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
    { id: user._id, username: user.username, role: role.name },
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
    token,
    user: {
      id: user._id,
      username: user.username,
      role: role.name,
      permissions: role.permissions,
    },
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
