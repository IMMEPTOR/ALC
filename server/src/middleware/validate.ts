import { Request, Response, NextFunction } from 'express';

// 6.1.1 — input validation. Lightweight schema-based validator.
// Validates required fields, types, length, regex format, and strips unknown keys.
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'objectId';

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
  pattern?: RegExp;
}

export interface Schema {
  [field: string]: FieldRule;
}

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

function checkValue(name: string, value: any, rule: FieldRule): string | null {
  if (value === undefined || value === null) {
    return rule.required ? `Поле "${name}" обязательно` : null;
  }
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `Поле "${name}" должно быть строкой`;
      if (rule.minLength !== undefined && value.length < rule.minLength) return `Поле "${name}" слишком короткое`;
      if (rule.maxLength !== undefined && value.length > rule.maxLength) return `Поле "${name}" слишком длинное`;
      if (rule.pattern && !rule.pattern.test(value)) return `Поле "${name}" имеет неверный формат`;
      if (rule.enum && !rule.enum.includes(value)) return `Поле "${name}" должно быть одним из: ${rule.enum.join(', ')}`;
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return `Поле "${name}" должно быть числом`;
      if (rule.min !== undefined && value < rule.min) return `Поле "${name}" меньше минимума`;
      if (rule.max !== undefined && value > rule.max) return `Поле "${name}" больше максимума`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `Поле "${name}" должно быть boolean`;
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return `Поле "${name}" должно быть объектом`;
      break;
    case 'array':
      if (!Array.isArray(value)) return `Поле "${name}" должно быть массивом`;
      break;
    case 'objectId':
      if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) return `Поле "${name}" должно быть валидным id`;
      break;
  }
  return null;
}

export const validateBody = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body || {};
    const errors: string[] = [];
    for (const [field, rule] of Object.entries(schema)) {
      const err = checkValue(field, body[field], rule);
      if (err) errors.push(err);
    }
    if (errors.length) {
      res.status(400).json({ error: 'Ошибка валидации', details: errors });
      return;
    }
    // Strip unknown fields to prevent mass assignment
    const cleaned: any = {};
    for (const field of Object.keys(schema)) {
      if (body[field] !== undefined) cleaned[field] = body[field];
    }
    req.body = cleaned;
    next();
  };
};
