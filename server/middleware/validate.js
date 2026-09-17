import { ZodError } from 'zod';
import { badInput } from '../lib/errors.js';

/**
 * One Zod schema per route, throws a clean 400 in the frozen error shape.
 *
 *   router.post('/', validate(BodySchema), async (req, res) => { req.valid ... })
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      req.valid = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map((e) => ({
          path: e.path.join('.') || '(root)',
          message: e.message,
        }));
        const summary = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
        return next(badInput(summary, { issues }));
      }
      next(err);
    }
  };
}

/** Same, for `:params` — used by /api/audit/:assetId. */
export const validateParams = (schema) => validate(schema, 'params');

/** Same, for `?query` strings. */
export const validateQuery = (schema) => validate(schema, 'query');
