import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Consistent error envelope. Stack traces and DB internals are never exposed.
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with this unique value already exists.' } });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
  }
  logger.error({ err: err.message }, 'unhandled error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
