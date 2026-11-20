import { config } from '../utils/config.js';
import { ApiError } from './apiError.js';
import { workService as mockWorkService } from './mock/mockWorkService.js';

// Retain the mock signatures for historical screens. Each future live module
// will introduce an asynchronous API adapter when its backend phase is built.
// No real authenticated account can accidentally read local mock records.
export const workService = Object.fromEntries(Object.entries(mockWorkService).map(([name, method]) => [name, (...args) => {
  if (!config.isMock) throw new ApiError('This workflow is not connected to the API yet.', { code: 'PHASE_NOT_IMPLEMENTED', status: 501 });
  return method(...args);
}]));
