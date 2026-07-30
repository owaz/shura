const { authenticateToken } = require('./auth');
const { errorResponse } = require('../utils/apiResponse');

const requireClient = (req, res, next) => authenticateToken(req, res, () => {
  if (req.user?.role !== 'client') {
    return errorResponse(res, 403, 'CLIENT_ROLE_REQUIRED', 'Client access is required.');
  }

  req.clientId = req.user.id;
  return next();
});

module.exports = { requireClient };
