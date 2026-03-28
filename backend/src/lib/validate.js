import { ZodError } from 'zod';
import { AppError } from './errors.js';

function normalizeIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateRequest({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (body) {
        Object.defineProperty(req, 'body', {
          value: body.parse(req.body || {}),
          configurable: true,
          enumerable: true,
          writable: true,
        });
      }
      if (query) {
        Object.defineProperty(req, 'query', {
          value: query.parse(req.query || {}),
          configurable: true,
          enumerable: true,
          writable: true,
        });
      }
      if (params) {
        Object.defineProperty(req, 'params', {
          value: params.parse(req.params || {}),
          configurable: true,
          enumerable: true,
          writable: true,
        });
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError(400, 'Request validation failed.', { issues: normalizeIssues(error) }));
      }
      return next(error);
    }
  };
}
