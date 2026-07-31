const { errorResponse } = require('../utils/apiResponse');

// Bearer tokens are not automatically attached by a browser, so CSRF does not
// apply to the current Auth0 API flow. This guard protects any future cookie
// authenticated state-changing API without breaking bearer-token clients.
const csrfProtection = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.headers.authorization) return next();

  return errorResponse(res, 403, 'CSRF_TOKEN_REQUIRED', 'A CSRF token is required for this request.');
};

module.exports = { csrfProtection };
