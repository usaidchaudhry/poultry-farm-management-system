// Every service throws this when something goes wrong, so the UI handles one error shape.
// code:        short machine-readable string, e.g. 'INVALID_CREDENTIALS'
// fieldErrors: optional { fieldName: 'message' } to show under form inputs
export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status, fieldErrors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Turns anything thrown (ApiError, Axios error, plain Error) into a safe message for the UI.
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) return error.message;
  return error?.response?.data?.message || fallback;
}
