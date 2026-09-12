import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { badRequest } from '../lib/errors';

/** Validate and REPLACE req.body with the parsed, typed value. */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(badRequest('Invalid request body', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

/** Parse query params in a handler, throwing a 400 on failure. */
export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): ZodInfer<S> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest('Invalid query parameters', result.error.flatten());
  }
  return result.data;
}
