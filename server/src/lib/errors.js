export class AppError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    Object.assign(this, { status, code, fieldErrors });
  }
}

export const denied = () => new AppError(403, 'FORBIDDEN', 'You do not have permission for this action.');
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Record not found.');

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let safe = error;
  if (error.code === 11000) safe = new AppError(409, 'DUPLICATE', 'A record with these unique values already exists.');
  if (error.name === 'CastError' || error.name === 'StrictModeError' || error.name === 'ValidationError') safe = new AppError(422, 'VALIDATION_ERROR', 'Check the supplied fields.');
  if (error.type === 'entity.parse.failed') safe = new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  if (error.type === 'entity.too.large') safe = new AppError(413, 'BODY_TOO_LARGE', 'Request exceeds the allowed size.');
  const known = safe instanceof AppError;
  if (!known && req.app.get('config').nodeEnv !== 'test') console.error(JSON.stringify({ requestId: req.id, event: 'request.failed', errorType: error.name || 'Error' }));
  res.status(known ? safe.status : 500).json({
    code: known ? safe.code : 'INTERNAL_ERROR',
    message: known ? safe.message : 'The request could not be completed. Try again.',
    ...(known && safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}),
    requestId: req.id,
  });
}
