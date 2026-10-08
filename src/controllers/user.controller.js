const prisma = require('../prisma');
const {
  hashSecret,
  verifySecret,
  generateToken
} = require('../utils/security');
const {
  normalizeRole
} = require('../middleware/auth.middleware');

/**
 * Sanitizes user record for client response (removes all sensitive hashes)
 */
function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    commission_rate: parseFloat(user.commission_rate || 0),
    flat_commission: parseFloat(user.flat_commission || 0),
    base_salary: parseFloat(user.base_salary || 0),
    is_active: user.is_active,
    has_password: Boolean(user.password_hash),
    permissions: require('../services/permission.service').effectivePermissions(user),
    has_pin: Boolean(user.pin_code),
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

/**
 * POST /api/auth/login
 * Real server-verified authentication with hashed credentials
 */
async function loginHandler(req, res, next) {
  try {
    const {
      username,
      name,
      password,
      pin
    } = req.body;
    const identifier = String(username || name || '').trim();
    if (!identifier && !pin && !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username/Name and Password or PIN are required.'
      });
    }
    let user = null;
    if (identifier) {
      // Find active user by name (case-insensitive)
      user = await prisma.user.findFirst({
        where: {
          name: {
            equals: identifier,
            mode: 'insensitive'
          },
          is_active: true
        }
      });
    } else if (pin) {
      // Fallback find by PIN
      const allActive = await prisma.user.findMany({
        where: {
          is_active: true
        }
      });
      user = allActive.find(u => verifySecret(pin, u.pin_code)) || null;
    }
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid user credentials or account is deactivated.'
      });
    }
    let authenticated = false;

    // Verify Password if provided
    if (password) {
      if (user.password_hash && verifySecret(password, user.password_hash)) {
        authenticated = true;
      }
    }

    // Or verify PIN if provided and not yet authenticated
    if (!authenticated && pin) {
      if (verifySecret(pin, user.pin_code)) {
        authenticated = true;
      }
    }
    if (!authenticated) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect password or approval PIN.'
      });
    }

    // Generate secure token
    const token = generateToken({
      id: user.id,
      name: user.name,
      role: normalizeRole(user.role),
      version: user.session_version
    });

    // Audit login
    await prisma.auditLog.create({
      data: {
        action: 'USER_LOGIN',
        description: `User "${user.name}" (${user.role}) logged in successfully.`,
        performed_by_user_id: user.id,
        performed_by_name: user.name
      }
    });
    res.cookie('dfpro_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      maxAge: 8 * 60 * 60 * 1000
    });
    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users
 * Returns list of staff members with roles and statuses (no secrets exposed)
 */
async function listUsersHandler(req, res, next) {
  try {
    const {
      include_inactive
    } = req.query;
    const where = include_inactive === 'true' ? {} : {
      is_active: true
    };
    const users = await prisma.user.findMany({
      where,
      orderBy: [{
        role: 'asc'
      }, {
        name: 'asc'
      }]
    });
    return res.status(200).json({
      status: 'success',
      data: req.user.role === 'WORKER' ? users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        is_active: u.is_active
      })) : users.map(sanitizeUser)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users
 * Create a new staff account (Admin only)
 */
async function createUserHandler(req, res, next) {
  try {
    const {
      name,
      role = 'Worker',
      password,
      pin_code,
      commission_rate = 0,
      flat_commission = 0,
      base_salary = 0
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Staff member name is required.'
      });
    }
    if (!['Admin', 'Accountant', 'Manager', 'Cashier', 'Worker', 'Investor'].includes(role)) return res.status(400).json({
      status: 'error',
      message: 'Choose a valid role.'
    });
    const cleanName = String(name).trim();

    // Check duplicate name
    const existing = await prisma.user.findFirst({
      where: {
        name: {
          equals: cleanName,
          mode: 'insensitive'
        }
      }
    });
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: `A staff member with name "${cleanName}" already exists.`
      });
    }
    if (role !== 'Worker' && !password || password && String(password).length < 8) return res.status(400).json({
      status: 'error',
      message: 'A password of at least 8 characters is required.'
    });
    const initialPassword = password;
    const passwordHash = hashSecret(initialPassword);
    if ((['Admin', 'Manager'].includes(role) || pin_code) && !/^\d{4,8}$/.test(String(pin_code || ''))) return res.status(400).json({
      status: 'error',
      message: 'PIN must contain 4 to 8 digits.'
    });
    const pinHash = pin_code ? hashSecret(pin_code) : '';
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        role: role || 'Worker',
        password_hash: passwordHash,
        pin_code: pinHash,
        commission_rate: parseFloat(commission_rate) || 0,
        flat_commission: parseFloat(flat_commission) || 0,
        base_salary: parseFloat(base_salary) || 0,
        is_active: true
      }
    });

    // Audit log without exposing secrets
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        description: `Staff account "${cleanName}" created with role "${role}" by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: {
          user_id: newUser.id,
          role: newUser.role
        }
      }
    });
    return res.status(201).json({
      status: 'success',
      message: `Staff account for "${cleanName}" created successfully.`,
      data: sanitizeUser(newUser)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id
 * Update staff details & role
 */
async function updateUserHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const {
      name,
      role,
      commission_rate,
      flat_commission,
      base_salary,
      is_active
    } = req.body;
    if (role !== undefined && !['Admin', 'Accountant', 'Manager', 'Cashier', 'Worker', 'Investor'].includes(role)) throw F.error('Choose a valid role.');
    if (is_active !== undefined && typeof is_active !== 'boolean') throw F.error('Active status must be a switch.');
    const data = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw F.error('Name is required.');
      data.name = String(name).trim();
    }
    if (role !== undefined) data.role = role;
    if (is_active !== undefined) data.is_active = is_active;
    for (const key of ['commission_rate', 'flat_commission', 'base_salary']) if (req.body[key] !== undefined) data[key] = F.amount(req.body[key], {
      zero: true
    });
    if (data.commission_rate > 100) throw F.error('Commission percentage cannot exceed 100.');
    const updated = await F.transact(async tx => {
      await F.lock(tx, 'user-admins');
      const user = await tx.user.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!user) throw F.error('User not found.', 404);
      if (user.role === 'Admin' && user.is_active && (role && role !== 'Admin' || is_active === false) && (await tx.user.count({
        where: {
          role: 'Admin',
          is_active: true
        }
      })) <= 1) throw F.error('Keep at least one active Admin account.', 409);
      const result = await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          ...data,
          session_version: {
            increment: 1
          }
        }
      });
      await F.audit(tx, req, 'USER_UPDATED', 'Staff account updated.', {
        user_id: user.id,
        role: result.role,
        is_active: result.is_active
      });
      return result;
    });
    res.json({
      status: 'success',
      data: sanitizeUser(updated)
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/users/:id/reset-password
 * Reset password (Admin resets staff, or User changes own password)
 */
async function resetPasswordHandler(req, res, next) {
  try {
    const {
      id
    } = req.params;
    const {
      new_password,
      current_password
    } = req.body;
    if (!new_password || String(new_password).length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 8 characters long.'
      });
    }
    const targetUser = await prisma.user.findUnique({
      where: {
        id
      }
    });
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.'
      });
    }
    const isSelf = req.user?.id === id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'Admin';
    if (!isSelf && !isAdmin) return res.status(403).json({
      status: 'error',
      message: 'Only Admin can reset another user password.'
    });

    // If changing own password and not admin, require current password verification
    if (isSelf && !isAdmin && targetUser.password_hash) {
      if (!current_password || !verifySecret(current_password, targetUser.password_hash)) {
        return res.status(403).json({
          status: 'error',
          message: 'Current password verification failed.'
        });
      }
    }
    const newHash = hashSecret(new_password);
    await prisma.user.update({
      where: {
        id
      },
      data: {
        password_hash: newHash,
        session_version: {
          increment: 1
        }
      }
    });

    // Audit log: NO passwords recorded!
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        description: `Password for "${targetUser.name}" was reset by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: {
          target_user_id: id,
          target_user_name: targetUser.name
        }
      }
    });
    return res.status(200).json({
      status: 'success',
      message: `Password for "${targetUser.name}" has been updated securely.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/:id/update-pin
 * Manage approval PINs separately (Admin or Manager)
 */
async function updatePinHandler(req, res, next) {
  try {
    const {
      id
    } = req.params;
    const {
      new_pin
    } = req.body;
    if (!/^\d{4,8}$/.test(String(new_pin || ''))) {
      return res.status(400).json({
        status: 'error',
        message: 'Approval PIN must be at least 4 digits.'
      });
    }
    const targetUser = await prisma.user.findUnique({
      where: {
        id
      }
    });
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.'
      });
    }
    const pinHash = hashSecret(String(new_pin).trim());
    await prisma.user.update({
      where: {
        id
      },
      data: {
        pin_code: pinHash,
        session_version: {
          increment: 1
        }
      }
    });

    // Audit log: NO pin value recorded!
    await prisma.auditLog.create({
      data: {
        action: 'APPROVAL_PIN_UPDATED',
        description: `Approval PIN updated for "${targetUser.name}" (${targetUser.role}) by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: {
          target_user_id: id
        }
      }
    });
    return res.status(200).json({
      status: 'success',
      message: `Approval PIN for "${targetUser.name}" updated successfully.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/toggle-status
 * Activate or deactivate staff account
 */
async function toggleUserStatusHandler(req, res, next) {
  try {
    const F = require('../services/finance.service');
    const updated = await F.transact(async tx => {
      await F.lock(tx, 'user-admins');
      const user = await tx.user.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!user) throw F.error('User not found.', 404);
      if (user.role === 'Admin' && user.is_active && (await tx.user.count({
        where: {
          role: 'Admin',
          is_active: true
        }
      })) <= 1) throw F.error('Keep at least one active Admin account.', 409);
      const value = await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          is_active: !user.is_active,
          session_version: {
            increment: 1
          }
        }
      });
      await F.audit(tx, req, value.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'Staff access status changed.', {
        user_id: user.id,
        is_active: value.is_active
      });
      return value;
    });
    res.json({
      status: 'success',
      data: sanitizeUser(updated)
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  loginHandler,
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  resetPasswordHandler,
  updatePinHandler,
  toggleUserStatusHandler,
  sanitizeUser
};
