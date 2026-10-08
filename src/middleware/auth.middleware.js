const prisma = require('../prisma');

/**
 * Normalizes user role string to uppercase standard: ADMIN, MANAGER, CASHIER, WORKER
 */
function normalizeRole(role) {
  if (!role) return 'CASHIER'; // Default safe minimum privilege if unspecified
  const r = String(role).trim().toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'MANAGER') return 'MANAGER';
  if (r === 'CASHIER') return 'CASHIER';
  if (r === 'WORKER') return 'WORKER';
  return r;
}

/**
 * Authentication extraction middleware:
 * Identifies current user and role from request headers:
 * - x-user-role: "ADMIN" | "MANAGER" | "CASHIER" | "WORKER"
 * - x-user-id: UUID of user
 * - authorization: optional Bearer token
 */
async function authenticateUser(req, res, next) {
  try {
    const rawRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    const role = user ? normalizeRole(user.role) : (rawRole ? normalizeRole(rawRole) : 'ADMIN');

    req.user = {
      id: user ? user.id : (userId || 'system-user'),
      name: user ? user.name : (rawRole ? `${rawRole} User` : 'Shop Admin'),
      role: role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control Middleware:
 * Allows only users whose normalized role matches one of the allowedRoles.
 * Returns 403 Forbidden if unauthorized.
 */
function requireRole(allowedRoles = []) {
  const normalizedAllowed = allowedRoles.map((r) => String(r).toUpperCase());

  return (req, res, next) => {
    const userRole = req.user ? normalizeRole(req.user.role) : normalizeRole(req.headers['x-user-role']);

    if (!normalizedAllowed.includes(userRole)) {
      console.log(`[RBAC FORBIDDEN 403] Role "${userRole}" blocked from ${req.originalUrl}. Allowed: [${normalizedAllowed}]`);
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Access restricted. Role "${userRole}" is not authorized for this resource. Required: [${normalizedAllowed.join(', ')}].`,
      });
    }

    next();
  };
}

/**
 * Verifies 4-digit PIN against Admin and Manager users in database.
 * Used for sensitive overrides (Credit notes, refunds, discounts).
 */
async function verifyAdminOrManagerPin(pin) {
  if (!pin) return { isValid: false, user: null };
  const cleanPin = String(pin).trim();

  // 1. Check in database for Admin or Manager
  const authorizedUser = await prisma.user.findFirst({
    where: {
      pin_code: cleanPin,
      role: { in: ['Admin', 'Manager'] },
      is_active: true,
    },
  });

  if (authorizedUser) {
    return {
      isValid: true,
      user: authorizedUser,
      role: normalizeRole(authorizedUser.role),
    };
  }

  // Fallback default admin PIN
  if (cleanPin === '1234') {
    return {
      isValid: true,
      user: { id: '00000000-0000-0000-0000-000000000001', name: 'Shop Admin', role: 'Admin' },
      role: 'ADMIN',
    };
  }

  return { isValid: false, user: null };
}

/**
 * Locks remote investor endpoints behind an Investor PIN or Admin/Manager role.
 * Essential for internet-exposed Cloudflare Tunnels.
 */
async function requireInvestorAuth(req, res, next) {
  try {
    const rawRole = req.headers['x-user-role'];
    const userRole = req.user && req.headers['x-user-id']
      ? normalizeRole(req.user.role)
      : (rawRole ? normalizeRole(rawRole) : null);

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      return next();
    }

    const providedPin = req.headers['x-investor-pin'] || req.query.pin || req.body?.pin;
    if (providedPin) {
      const cleanPin = String(providedPin).trim();
      // Verified investor pins: dedicated investor PIN '1122', default '1234', or admin PIN
      if (cleanPin === '1122' || cleanPin === '1234') {
        return next();
      }

      const verified = await verifyAdminOrManagerPin(cleanPin);
      if (verified.isValid) {
        return next();
      }
    }

    return res.status(401).json({
      status: 'error',
      message: 'Investor authentication required. Provide a valid Investor PIN header ("x-investor-pin") or Admin credentials.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateUser,
  requireRole,
  requireInvestorAuth,
  verifyAdminOrManagerPin,
  normalizeRole,
};

