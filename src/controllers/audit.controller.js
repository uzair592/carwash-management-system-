const { getAuditLogs } = require('../services/audit.service');

/**
 * GET /api/audit-logs
 * Retrieves chronological immutable audit logs.
 * Restricted strictly to ADMIN role.
 */
async function listAuditLogsHandler(req, res, next) {
  try {
    const { limit, page, action } = req.query;
    const result = await getAuditLogs({ limit, page, action });

    return res.status(200).json({
      status: 'success',
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuditLogsHandler,
};
