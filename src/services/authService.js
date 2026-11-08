import { mockAuthService } from './mock/mockAuthService.js';

/*
  The UI imports ONLY this file for authentication.
  When the Express API exists, replace the body of each function with an Axios call
  (using `api` from ./api.js) and keep the same inputs and return shapes:
    login({ email, password })  -> { user, token }
    getCurrentUser(userId)      -> user
    logout()                    -> void
*/
export const authService = {
  login: (credentials) => mockAuthService.login(credentials),
  getCurrentUser: (userId) => mockAuthService.getCurrentUser(userId),
  logout: () => mockAuthService.logout(),
};
