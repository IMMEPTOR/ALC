import { Request, Response, NextFunction } from 'express';

// 6.3.2 — protect against NoSQL injection by stripping `$` and `.` from keys.
// Recursively walks body/query/params and deletes suspicious keys.
function sanitizeObject(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') sanitizeObject(val);
  }
}

export const mongoSanitize = (req: Request, _res: Response, next: NextFunction): void => {
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  // req.query is a getter in Express 5 — sanitize properties in place
  if (req.query) sanitizeObject(req.query);
  next();
};
