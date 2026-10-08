const prisma = require('../prisma');
const {
  CATALOG,
  KEYS,
  effectivePermissions
} = require('../services/permission.service');
const F = require('../services/finance.service');
async function listPermissions(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['Admin', 'Accountant', 'Manager', 'Cashier']
        },
        is_active: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json({
      status: 'success',
      data: {
        catalog: CATALOG,
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          permissions: effectivePermissions(u)
        }))
      }
    });
  } catch (e) {
    next(e);
  }
}
async function updatePermissions(req, res, next) {
  try {
    const grants = req.body.permissions;
    if (!grants || typeof grants !== 'object' || Array.isArray(grants) || Object.keys(grants).some(k => !KEYS.includes(k) || typeof grants[k] !== 'boolean')) throw F.error('Supply valid permission switches.');
    await F.transact(async tx => {
      await F.lock(tx, 'permissions:' + req.params.id);
      const user = await tx.user.findUnique({
        where: {
          id: req.params.id
        }
      });
      if (!user || !['Accountant', 'Manager', 'Cashier'].includes(user.role)) throw F.error('Admin access is fixed; configure an operator account instead.');
      const permissions = {
        ...effectivePermissions(user),
        ...grants
      };
      await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          permissions
        }
      });
      await F.audit(tx, req, 'PERMISSIONS_UPDATED', 'Operator access changed.', {
        user_id: user.id,
        permissions
      });
    });
    res.json({
      status: 'success'
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  listPermissions,
  updatePermissions
};
