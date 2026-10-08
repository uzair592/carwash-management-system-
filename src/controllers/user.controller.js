const prisma = require('../prisma');
const { hashSecret, verifySecret, generateToken } = require('../utils/security');
const { normalizeRole } = require('../middleware/auth.middleware');

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
    has_pin: Boolean(user.pin_code),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

/**
 * POST /api/auth/login
 * Real server-verified authentication with hashed credentials
 */
async function loginHandler(req, res, next) {
  try {
    const { username, name, password, pin } = req.body;
    const identifier = String(username || name || '').trim();

    if (!identifier && !pin && !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username/Name and Password or PIN are required.',
      });
    }

    let user = null;

    if (identifier) {
      // Find active user by name (case-insensitive)
      user = await prisma.user.findFirst({
        where: {
          name: { equals: identifier, mode: 'insensitive' },
          is_active: true,
        },
      });
    } else if (pin) {
      // Fallback find by PIN
      const allActive = await prisma.user.findMany({ where: { is_active: true } });
      user = allActive.find((u) => verifySecret(pin, u.pin_code)) || null;
    }

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid user credentials or account is deactivated.',
      });
    }

    let authenticated = false;

    // Verify Password if provided
    if (password) {
      if (user.password_hash && verifySecret(password, user.password_hash)) {
        authenticated = true;
      } else if (!user.password_hash && (password === 'admin123' || password === 'password123' || password === user.pin_code)) {
        // First-time fallback for unhashed default accounts
        authenticated = true;
        // Automatically upgrade to secure hash
        await prisma.user.update({
          where: { id: user.id },
          data: { password_hash: hashSecret(password) },
        });
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
        message: 'Incorrect password or approval PIN.',
      });
    }

    // Generate secure token
    const token = generateToken({
      id: user.id,
      name: user.name,
      role: normalizeRole(user.role),
      timestamp: Date.now(),
    });

    // Audit login
    await prisma.auditLog.create({
      data: {
        action: 'USER_LOGIN',
        description: `User "${user.name}" (${user.role}) logged in successfully.`,
        performed_by_user_id: user.id,
        performed_by_name: user.name,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
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
    const { include_inactive } = req.query;
    const where = include_inactive === 'true' ? {} : { is_active: true };

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return res.status(200).json({
      status: 'success',
      data: users.map(sanitizeUser),
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
      pin_code = '1234',
      commission_rate = 0,
      flat_commission = 0,
      base_salary = 0,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Staff member name is required.',
      });
    }

    const cleanName = String(name).trim();

    // Check duplicate name
    const existing = await prisma.user.findFirst({
      where: { name: { equals: cleanName, mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: `A staff member with name "${cleanName}" already exists.`,
      });
    }

    const initialPassword = password || 'welcome123';
    const passwordHash = hashSecret(initialPassword);
    const pinHash = hashSecret(pin_code || '1234');

    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        role: role || 'Worker',
        password_hash: passwordHash,
        pin_code: pinHash,
        commission_rate: parseFloat(commission_rate) || 0,
        flat_commission: parseFloat(flat_commission) || 0,
        base_salary: parseFloat(base_salary) || 0,
        is_active: true,
      },
    });

    // Audit log without exposing secrets
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        description: `Staff account "${cleanName}" created with role "${role}" by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { user_id: newUser.id, role: newUser.role },
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Staff account for "${cleanName}" created successfully.`,
      data: sanitizeUser(newUser),
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
    const { id } = req.params;
    const { name, role, commission_rate, flat_commission, base_salary, is_active } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        role: role !== undefined ? role : undefined,
        commission_rate: commission_rate !== undefined ? parseFloat(commission_rate) : undefined,
        flat_commission: flat_commission !== undefined ? parseFloat(flat_commission) : undefined,
        base_salary: base_salary !== undefined ? parseFloat(base_salary) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_UPDATED',
        description: `Staff account "${user.name}" updated (Role: ${user.role} -> ${updated.role}) by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { user_id: id, changes: { role, is_active } },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Staff account updated successfully.',
      data: sanitizeUser(updated),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users/:id/reset-password
 * Reset password (Admin resets staff, or User changes own password)
 */
async function resetPasswordHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { new_password, current_password } = req.body;

    if (!new_password || String(new_password).length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 4 characters long.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const isSelf = req.user?.id === id;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'Admin';

    // If changing own password and not admin, require current password verification
    if (isSelf && !isAdmin && targetUser.password_hash) {
      if (!current_password || !verifySecret(current_password, targetUser.password_hash)) {
        return res.status(403).json({
          status: 'error',
          message: 'Current password verification failed.',
        });
      }
    }

    const newHash = hashSecret(new_password);
    await prisma.user.update({
      where: { id },
      data: { password_hash: newHash },
    });

    // Audit log: NO passwords recorded!
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        description: `Password for "${targetUser.name}" was reset by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { target_user_id: id, target_user_name: targetUser.name },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Password for "${targetUser.name}" has been updated securely.`,
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
    const { id } = req.params;
    const { new_pin } = req.body;

    if (!new_pin || String(new_pin).trim().length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'Approval PIN must be at least 4 digits.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const pinHash = hashSecret(String(new_pin).trim());
    await prisma.user.update({
      where: { id },
      data: { pin_code: pinHash },
    });

    // Audit log: NO pin value recorded!
    await prisma.auditLog.create({
      data: {
        action: 'APPROVAL_PIN_UPDATED',
        description: `Approval PIN updated for "${targetUser.name}" (${targetUser.role}) by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { target_user_id: id },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Approval PIN for "${targetUser.name}" updated successfully.`,
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
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Safety check: Don't deactivate the last active admin
    if (targetUser.role === 'Admin' && targetUser.is_active) {
      const activeAdmins = await prisma.user.count({
        where: { role: 'Admin', is_active: true },
      });
      if (activeAdmins <= 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot deactivate the sole remaining Admin account.',
        });
      }
    }

    const newStatus = !targetUser.is_active;
    const updated = await prisma.user.update({
      where: { id },
      data: { is_active: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        description: `Staff account "${targetUser.name}" was ${newStatus ? 'activated' : 'deactivated'} by ${req.user?.name || 'Admin'}.`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: { target_user_id: id, new_status: newStatus },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Staff member "${targetUser.name}" is now ${newStatus ? 'Active' : 'Deactivated'}.`,
      data: sanitizeUser(updated),
    });
  } catch (error) {
    next(error);
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
  sanitizeUser,
};
