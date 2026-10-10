const CATALOG = [['intake.manage', 'Create work tickets', 'Workshop'], ['workshop.read', 'View workshop', 'Workshop'], ['workshop.manage', 'Assign bays and complete work', 'Workshop'], ['job.services', 'Add/remove job services', 'Workshop'], ['billing.read', 'View invoices', 'Billing'], ['billing.manage', 'Collect payments', 'Billing'], ['billing.discount', 'Discounts without another approval', 'Billing'], ['billing.refund', 'Issue refunds without another approval', 'Billing'], ['billing.reverse', 'Reverse payments without another approval', 'Billing'], ['print.use', 'Print tickets and bills', 'Billing'], ['customers.read', 'Loyal customers', 'Management'], ['customers.manage', 'Edit customer profiles and advances', 'Management'], ['reports.read', 'Reports', 'Management'], ['staff.read', 'Staff performance', 'Management'], ['overview.read', 'Business overview', 'Management'], ['overview.dispatch', 'Send daily summary', 'Management'], ['inventory.read', 'View stock', 'Finance'], ['inventory.manage', 'Restock and adjust stock', 'Finance'], ['materials.manage', 'Issue job materials', 'Finance'], ['finance.read', 'View cash and bank accounts', 'Finance'], ['finance.manage', 'Expenses and account transfers', 'Finance'], ['banks.manage', 'Create/edit bank accounts', 'Finance'], ['services.read', 'View service catalog', 'Management'], ['services.manage', 'Edit service catalog', 'Management'], ['payroll.read', 'View payroll', 'Finance'], ['payroll.manage', 'Edit salary and commissions', 'Finance'], ['partners.read', 'View partner accounts', 'Finance'], ['partners.manage', 'Edit equity and capital', 'Finance'], ['audit.read', 'View audit trail', 'Finance'], ['branding.read', 'View print configuration', 'Settings'], ['branding.manage', 'Change branding and print templates', 'Settings'], ['settings.read', 'Open Settings', 'Settings'], ['settings.manage', 'Change devices and notifications', 'Settings']].map(([key, label, group]) => ({
  key,
  label,
  group
}));
const KEYS = CATALOG.map(p => p.key);
const accountantDenied = new Set(['billing.refund', 'billing.reverse', 'banks.manage', 'partners.read', 'partners.manage', 'branding.manage', 'settings.manage']);
function effectivePermissions(user) {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'ADMIN') return Object.fromEntries(KEYS.map(k => [k, true]));
  let allowed = [];
  if (role === 'ACCOUNTANT') allowed = KEYS.filter(k => !accountantDenied.has(k));
  const result = Object.fromEntries(KEYS.map(k => [k, allowed.includes(k)]));
  // Only the Accountant receives configurable grants; Admin access is fixed.
  if (role === 'ACCOUNTANT') for (const key of KEYS) if (typeof user?.permissions?.[key] === 'boolean') result[key] = user.permissions[key];
  return result;
}
function can(user, key) {
  return user?.permissions && typeof user.permissions[key] === 'boolean' ? user.permissions[key] : effectivePermissions(user)[key] === true;
}
async function approval(req, permission) {
  if (can(req.user, permission)) return {
    isValid: true,
    user: {
      id: req.user.id,
      name: req.user.name
    },
    source: 'SESSION'
  };
  return require('../middleware/auth.middleware').verifyAdminOrManagerPin(req.body.admin_pin);
}
function requiredPermission(req) {
  const p = req.path,
    read = req.method === 'GET';
  if (p === '/auth/me' || p === '/auth/logout' || p === '/auth/verify-pin' || p === '/admin/verify-pin') return null;
  if (p.startsWith('/backups')) return 'ADMIN_ONLY';
  if (p.startsWith('/permissions')) return 'ADMIN_ONLY';
  if (p.startsWith('/staff')) return read ? 'ROSTER' : 'ADMIN_ONLY';
  if (p.startsWith('/users')) {
    if (read) return 'ROSTER';
    if (p === `/users/${req.user.id}/reset-password`) return null;
    return 'ADMIN_ONLY';
  }
  if (p.startsWith('/branding')) return read ? 'branding.read' : 'branding.manage';
  if (p.startsWith('/printer')) return p.startsWith('/printer/settings') ? read ? 'PRINTER_CONFIG_READ' : 'settings.manage' : 'print.use';
  if (p.startsWith('/alerts')) return read ? 'settings.read' : 'settings.manage';
  if (p.startsWith('/settings')) return read ? 'settings.read' : 'settings.manage';
  if (p.startsWith('/reports')) return 'reports.read';
  if (p.startsWith('/leaderboard')) return 'staff.read';
  if (p.startsWith('/dashboard')) return read ? 'overview.read' : 'overview.dispatch';
  if (p.startsWith('/camera/arrivals')) return 'intake.manage';
  if (p === '/intake' || p === '/vehicles/intake') return 'intake.manage';
  if (p.startsWith('/vehicles')) return 'intake.manage';
  if (p.startsWith('/customers')) return read ? 'customers.read' : 'customers.manage';
  if (p.startsWith('/loyalty')) return 'customers.read';
  if (p.startsWith('/deposits')) return read ? 'customers.read' : 'customers.manage';
  if (p.startsWith('/bays')) return 'workshop.read';
  if (/^\/job-cards\/[^/]+\/services/.test(p)) return 'job.services';
  if (p.startsWith('/job-cards')) return read ? 'workshop.read' : 'workshop.manage';
  if (p.startsWith('/materials')) return read ? 'workshop.read' : 'materials.manage';
  if (p.startsWith('/invoices') || p === '/checkout') {
    if (read) return 'billing.read';
    if (p.endsWith('/refund')) return 'billing.refund';
    if (p.endsWith('/reverse-payment')) return 'billing.reverse';
    return 'billing.manage';
  }
  if (p.startsWith('/services')) return read ? 'services.read' : 'services.manage';
  if (p.startsWith('/inventory/yield-mappings')) return read ? 'inventory.read' : 'inventory.manage';
  if (p.startsWith('/inventory')) return read ? 'inventory.read' : 'inventory.manage';
  if (/^\/payroll\/users\/[^/]+\/salary$/.test(p)) return 'ADMIN_ONLY';
  if (p.startsWith('/financials/payroll') || p.startsWith('/payroll')) return read ? 'payroll.read' : 'payroll.manage';
  if (p.startsWith('/financials') || p.startsWith('/partners') || p.startsWith('/partner-transactions')) return read ? 'partners.read' : 'partners.manage';
  if (p.startsWith('/audit')) return 'audit.read';
  if (p.startsWith('/banks')) return read ? 'finance.read' : 'banks.manage';
  if (p.startsWith('/ledger') || p.startsWith('/register') || p.startsWith('/transfers') || p.startsWith('/expenses') || p === '/expense' || p === '/payment') return read ? 'finance.read' : 'finance.manage';
  return 'UNKNOWN';
}
function enforcePermissions(req, res, next) {
  const permission = requiredPermission(req);
  const role = req.user.role;
  const allowed = permission === null || permission === 'ADMIN_ONLY' && role === 'ADMIN' || permission === 'ROSTER' && (can(req.user, 'workshop.read') || can(req.user, 'staff.read')) || permission === 'PRINTER_CONFIG_READ' && (can(req.user, 'print.use') || can(req.user, 'settings.read')) || can(req.user, permission);
  if (!allowed) return res.status(403).json({
    status: 'error',
    message: 'Your account does not have permission for this action.'
  });
  return next();
}
module.exports = {
  CATALOG,
  KEYS,
  effectivePermissions,
  can,
  approval,
  requiredPermission,
  enforcePermissions
};
