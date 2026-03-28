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
        req.body = body.parse(req.body || {});
      }
      if (query) {
        req.query = query.parse(req.query || {});
      }
      if (params) {
        req.params = params.parse(req.params || {});
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

