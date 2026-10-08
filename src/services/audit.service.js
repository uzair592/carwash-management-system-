const prisma = require('../prisma');

/**
 * Service to record immutable audit log entries for sensitive shop actions:
 * - Register session closed with variance (missing money)
 * - Discount applied to invoice
 * - Credit Note / Refund issued
 * - Manual inventory adjustment or restock
 */
async function logAuditEvent({
  action,
  description,
  performed_by_user_id = null,
  performed_by_name = null,
  metadata = null,
}) {
  try {
    // If name not provided but ID is, attempt user lookup
    let resolvedName = performed_by_name;
    if (!resolvedName && performed_by_user_id) {
      const user = await prisma.user.findUnique({
        where: { id: performed_by_user_id },
        select: { name: true, role: true },
      });
      if (user) {
        resolvedName = `${user.name} (${user.role})`;
      }
    }

    const log = await prisma.auditLog.create({
      data: {
        action: String(action).toUpperCase(),
        description: String(description),
        performed_by_user_id: performed_by_user_id || null,
        performed_by_name: resolvedName || 'System Admin',
        metadata: metadata ? (typeof metadata === 'object' ? metadata : { raw: metadata }) : undefined,
      },
    });

    console.log(`[AuditLog] [${log.action}] ${log.description} | By: ${log.performed_by_name}`);
    return log;
  } catch (error) {
    console.error('[AuditLog] Error recording audit log:', error.message);
    // Non-blocking: Audit failure should not crash main transaction unless critical
    return null;
  }
}

/**
 * Retrieve chronological audit logs with optional filtering
 */
async function getAuditLogs({ limit = 100, page = 1, action = null } = {}) {
  const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

  const where = {};
  if (action && action.trim()) {
    where.action = { equals: action.trim().toUpperCase() };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page, 10) || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
}

module.exports = {
  logAuditEvent,
  getAuditLogs,
};
