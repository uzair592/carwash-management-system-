const prisma = require('../prisma');
const {
  verifySecret,
  verifyToken
} = require('../utils/security');
function normalizeRole(role) {
  return String(role || '').toUpperCase();
}
async function authenticateUser(req, res, next) {
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || /(?:^|; )dfpro_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const payload = verifyToken(token);
    if (!payload?.id) return res.status(401).json({
      status: 'error',
      message: 'Please sign in.'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: payload.id
      }
    });
    if (!user?.is_active || payload.version !== user.session_version) return res.status(401).json({
      status: 'error',
      message: 'Session expired. Please sign in again.'
    });
    req.user = {
      id: user.id,
      name: user.name,
      role: normalizeRole(user.role),
      permissions: require("../services/permission.service").effectivePermissions(user)
    };
    next();
  } catch (error) {
    next(error);
  }
}
function requireRole(roles = []) {
  return (req, res, next) => roles.map(normalizeRole).includes(req.user?.role) ? next() : res.status(403).json({
    status: 'error',
    message: 'This action is not permitted for your account.'
  });
}
async function verifyAdminOrManagerPin(pin) {
  if (!/^\d{4,8}$/.test(String(pin || ''))) return {
    isValid: false,
    user: null
  };
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['Admin', 'Manager']
      },
      is_active: true
    }
  });
  const user = users.find(u => verifySecret(String(pin), u.pin_code));
  return {
    isValid: Boolean(user),
    user: user || null,
    role: user ? normalizeRole(user.role) : null
  };
}
const requireInvestorAuth = (req, res, next) => require('../services/permission.service').can(req.user, 'overview.read') ? next() : res.status(403).json({
  message: 'Overview access denied.'
});
module.exports = {
  authenticateUser,
  requireRole,
  requireInvestorAuth,
  verifyAdminOrManagerPin,
  normalizeRole
};
