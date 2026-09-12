import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { config } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }
  // Never leak internal error detail or stack traces to clients.
  if (!config.isProd) {
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
  }
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
