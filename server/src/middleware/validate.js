import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

// Validate req.body / req.query / req.params against zod schemas.
// On failure, returns a 400 with field-level messages — never a stack trace.
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      return next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return next(badRequest(details));
      }
      return next(err);
    }
  };
}

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
