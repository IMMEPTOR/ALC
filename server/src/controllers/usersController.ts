import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Role } from '../models';

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find().populate('role_id', 'name permissions').select('-password_hash');
  res.json(users);
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id).populate('role_id', 'name permissions').select('-password_hash');
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  res.json(user);
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password, role_name } = req.body;
  if (!username || !password || !role_name) {
    res.status(400).json({ error: 'username, password и role_name обязательны' });
    return;
  }

  const role = await Role.findOne({ name: role_name });
  if (!role) {
    res.status(400).json({ error: 'Роль не найдена' });
    return;
  }

  const existing = await User.findOne({ username });
  if (existing) {
    res.status(409).json({ error: 'Пользователь уже существует' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password_hash, role_id: role._id });
  res.status(201).json({ id: user._id, username: user.username });
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const updates: any = {};
  if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
  if (req.body.role_name) {
    const role = await Role.findOne({ name: req.body.role_name });
    if (!role) { res.status(400).json({ error: 'Роль не найдена' }); return; }
    updates.role_id = role._id;
  }
  if (req.body.password) {
    updates.password_hash = await bcrypt.hash(req.body.password, 10);
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('role_id', 'name permissions').select('-password_hash');
  if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
  res.json(user);
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
  res.json({ message: 'Пользователь удален' });
};
