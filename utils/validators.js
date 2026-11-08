// Small validation helpers. Each returns an error message, or '' when the value is valid.
export const required = (value, label = 'This field') =>
  value === undefined || value === null || String(value).trim() === '' ? `${label} is required.` : '';

export const minLength = (value, min, label = 'This field') =>
  String(value || '').trim().length < min ? `${label} must be at least ${min} characters.` : '';

export const positiveNumber = (value, label = 'This field') => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? '' : `${label} must be a number greater than 0.`;
};

// Runs several checks and returns the first error message found.
export const firstError = (...results) => results.find(Boolean) || '';

export const email = (value, label = 'Email') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) ? '' : `Enter a valid ${label.toLowerCase()} address.`;
