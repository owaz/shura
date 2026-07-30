const errorResponse = (res, status, code, message, details = null) =>
  res.status(status).json({ error: { code, message, details } });

const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Number.parseInt(query?.page, 10) || 1);
  const requestedLimit = Number.parseInt(query?.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
};

const paginatedResponse = (res, data, { page, limit, total }) =>
  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });

module.exports = { errorResponse, parsePagination, paginatedResponse };
