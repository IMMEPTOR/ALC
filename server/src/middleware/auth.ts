import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models';
import logger from '../logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Токен не предоставлен' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const userId = decoded.user_id || decoded.id;
    const user = await User.findById(userId).populate('role_id');
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
      return;
    }
    const role = user.role_id as any;
    req.user = {
      id: user._id.toString(),
      username: user.username,
      role: role.name,
      permissions: role.permissions,
    };
    next();
  } catch {
    logger.warn('Invalid token attempt', { action: 'auth_failed', ip: req.ip });
    res.status(401).json({ error: 'Недействительный токен' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(`Access denied for ${req.user?.username || 'unknown'}: role ${req.user?.role} not in [${roles.join(', ')}]`, {
        action: 'access_denied',
        userId: req.user?.id,
        requiredRoles: roles,
        userRole: req.user?.role,
      });
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    next();
  };
};
