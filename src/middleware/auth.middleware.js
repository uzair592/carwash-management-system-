const prisma = require('../prisma');
const { verifySecret, verifyToken } = require('../utils/security');

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
 * - authorization: Bearer <token>
 * - x-user-role: "ADMIN" | "MANAGER" | "CASHIER" | "WORKER"
 * - x-user-id: UUID of user
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const rawRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let user = null;

    // Check signed token if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = verifyToken(token);
      if (!payload || !payload.id) {
        return res.status(401).json({
          status: 'error',
          message: 'Unauthorized: Invalid or expired authentication token.',
        });
      }
      user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user || !user.is_active) {
        return res.status(401).json({
          status: 'error',
          message: 'Unauthorized: User account not found or is deactivated.',
        });
      }
    }

    if (!user && userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    // Role resolution: authenticated user > explicitly supplied role header > safe minimum Cashier
    const role = user ? normalizeRole(user.role) : (rawRole ? normalizeRole(rawRole) : 'CASHIER');

    req.user = {
      id: user ? user.id : (userId || 'cashier-session'),
      name: user ? user.name : (rawRole ? `${rawRole} User` : 'Shop Cashier'),
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
    const userRole = req.user ? normalizeRole(req.user.role) : 'UNAUTHENTICATED';

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
 * Verifies PIN against Admin and Manager users in database (supporting both hashed and legacy PINs).
 * Used for sensitive overrides (Credit notes, refunds, discounts, price overrides).
 */
async function verifyAdminOrManagerPin(pin) {
  if (!pin) return { isValid: false, user: null };
  const cleanPin = String(pin).trim();

  // 1. Check in database for Admin or Manager using verifySecret
  const authorizedUsers = await prisma.user.findMany({
    where: {
      role: { in: ['Admin', 'Manager'] },
      is_active: true,
    },
  });

  const matched = authorizedUsers.find((u) => verifySecret(cleanPin, u.pin_code));
  if (matched) {
    return {
      isValid: true,
      user: matched,
      role: normalizeRole(matched.role),
    };
  }

  // Fallback default admin PIN
  if (cleanPin === '1234' || cleanPin === '1122') {
    const adminUser = authorizedUsers.find((u) => u.role === 'Admin') || {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shop Admin',
      role: 'Admin',
    };
    return {
      isValid: true,
      user: adminUser,
      role: 'ADMIN',
    };
  }

  return { isValid: false, user: null };
}

/**
 * Locks remote investor endpoints behind an Investor PIN or Admin/Manager role.
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
