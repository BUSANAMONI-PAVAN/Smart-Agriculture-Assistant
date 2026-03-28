export class AppError extends Error {
  constructor(status, message, detail = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.detail = detail;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}

export function isDatabaseUnavailableError(error) {
  return isAppError(error) && error.status === 503;
}
