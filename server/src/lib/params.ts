import type { Request } from 'express';
import { badRequest } from './errors';

/** Safely read a required path parameter. */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Missing path parameter: ${name}`);
  }
  return value;
}
