import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Key, Shield, ShieldCheck, CheckCircle, XCircle, Lock, Edit, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
const money = val => Number(val || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
export default function AdminStaffTab() {
  const {
    currentUser
  } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    role: 'Worker',
    password: '',
    pin_code: '',
    base_salary: '30000',
    flat_commission: '150',
    commission_rate: '0'
  });
  const [resetPasswordModal, setResetPasswordModal] = useState(null); // target user object
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [updatePinModal, setUpdatePinModal] = useState(null); // target user object
  const [newPin, setNewPin] = useState('');
  const [editUserModal, setEditUserModal] = useState(null); // target user object
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    role: '',
    base_salary: '',
    flat_commission: '',
    commission_rate: ''
  });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/users?include_inactive=true');
      setUsers(res.data?.data || []);
    } catch (err) {
      setErrorMsg('Failed to load staff accounts.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchUsers();
  }, []);
  const handleCreateUser = async e => {
    e.preventDefault();
    if (!addUserForm.name.trim()) return;
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await axios.post('/api/users', {
        ...addUserForm,
        base_salary: parseFloat(addUserForm.base_salary) || 0,
        flat_commission: parseFloat(addUserForm.flat_commission) || 0,
        commission_rate: parseFloat(addUserForm.commission_rate) || 0
      });
      setSuccessMsg(`Staff account "${addUserForm.name}" created successfully.`);
      setIsAddUserOpen(false);
      setAddUserForm({
        name: '',
        role: 'Worker',
        password: '',
        pin_code: '',
        base_salary: '30000',
        flat_commission: '150',
        commission_rate: '0'
      });
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create user account.');
    } finally {
      setIsActionLoading(false);
    }
  };
  const handleResetPassword = async e => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/users/${resetPasswordModal.id}/reset-password`, {
        new_password: newPassword,
        current_password: currentPassword || undefined
      });
      setSuccessMsg(`Password for "${resetPasswordModal.name}" updated securely.`);
      setResetPasswordModal(null);
      setNewPassword('');
      setCurrentPassword('');
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setIsActionLoading(false);
    }
  };
  const handleUpdatePin = async e => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      setErrorMsg('Approval PIN must be at least 4 digits.');
      return;
    }
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/users/${updatePinModal.id}/update-pin`, {
        new_pin: newPin
      });
      setSuccessMsg(`Approval PIN for "${updatePinModal.name}" updated successfully.`);
      setUpdatePinModal(null);
      setNewPin('');
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update approval PIN.');
    } finally {
      setIsActionLoading(false);
    }
  };
  const handleEditUser = async e => {
    e.preventDefault();
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await axios.put(`/api/users/${editUserModal.id}`, {
        name: editUserForm.name.trim(),
        role: editUserForm.role,
        base_salary: parseFloat(editUserForm.base_salary) || 0,
        flat_commission: parseFloat(editUserForm.flat_commission) || 0,
        commission_rate: parseFloat(editUserForm.commission_rate) || 0
      });
      setSuccessMsg(`Staff details for "${editUserForm.name}" updated.`);
      setEditUserModal(null);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setIsActionLoading(false);
    }
  };
  const handleToggleStatus = async user => {
    try {
      await axios.patch(`/api/users/${user.id}/toggle-status`);
      await fetchUsers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to change account status.');
    }
  };
  return <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Staff Accounts & Credential Security
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Administer staff roles, reset account passwords, and manage sensitive approval PINs separately. Passwords and PINs are securely hashed and never displayed in plaintext.
          </p>
        </div>
        <button onClick={() => setIsAddUserOpen(true)} className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-sm">
          <UserPlus className="w-4 h-4" />
          Create Staff Account
        </button>
      </div>

      {errorMsg && <div className="form-error flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
          <button className="ml-auto text-xs underline" onClick={() => setErrorMsg('')}>Dismiss</button>
        </div>}

      {successMsg && <div className="status-badge success flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>}

      {/* Staff Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Compensation</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Credentials</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading staff members...
                  </td>
                </tr> : users.length === 0 ? <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No staff accounts found.
                  </td>
                </tr> : users.map(u => {
              const isCurrent = currentUser?.id === u.id;
              return <tr key={u.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          {u.name}
                          {isCurrent && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              YOU
                            </span>}
                        </div>
                        <span className="text-xs text-slate-400">ID: {u.id.slice(0, 8)}...</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${u.role === 'Admin' ? 'bg-rose-100 text-rose-800' : u.role === 'Manager' ? 'bg-purple-100 text-purple-800' : u.role === 'Cashier' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div>Base: Rs. {money(u.base_salary)}</div>
                        {u.flat_commission > 0 && <div className="text-emerald-700">Commission: Rs. {money(u.flat_commission)}/car</div>}
                        {u.commission_rate > 0 && <div className="text-purple-700">Commission: {u.commission_rate}%</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <button onClick={() => handleToggleStatus(u)} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${u.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title="Click to toggle active/inactive status">
                          {u.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            Password: <strong className="text-emerald-700">Hashed</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Key className="w-3.5 h-3.5 text-slate-400" />
                            PIN: <strong className="text-emerald-700">Hashed</strong>
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button onClick={() => {
                      setResetPasswordModal(u);
                      setNewPassword('');
                      setCurrentPassword('');
                    }} className="btn btn-secondary text-xs px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1 hover:bg-slate-100" title="Reset password">
                            <Lock className="w-3 h-3 text-slate-500" />
                            Password
                          </button>
                          <button onClick={() => {
                      setUpdatePinModal(u);
                      setNewPin('');
                    }} className="btn btn-secondary text-xs px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1 hover:bg-slate-100" title="Manage approval PIN separately">
                            <Key className="w-3 h-3 text-slate-500" />
                            PIN
                          </button>
                          <button onClick={() => {
                      setEditUserModal(u);
                      setEditUserForm({
                        name: u.name,
                        role: u.role,
                        base_salary: String(u.base_salary),
                        flat_commission: String(u.flat_commission),
                        commission_rate: String(u.commission_rate)
                      });
                    }} className="btn btn-secondary text-xs px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1 hover:bg-slate-100" title="Edit details">
                            <Edit className="w-3 h-3 text-slate-500" />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>;
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add User */}
      {isAddUserOpen && <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Create Staff Account
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input type="text" required placeholder="e.g. Asad Khan" value={addUserForm.name} onChange={e => setAddUserForm({
              ...addUserForm,
              name: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select value={addUserForm.role} onChange={e => setAddUserForm({
                ...addUserForm,
                role: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none">
                    <option value="Worker">Worker (Bay Floor)</option>
                    <option value="Cashier">Cashier (POS & Billing)</option>
                    <option value="Manager">Manager (Approvals & Inventory)</option>
                    <option value="Investor">Investor (Read-only overview)</option><option value="Admin">Admin (Full Control)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Password
                  </label>
                  <input type="password" placeholder="Min 4 characters" value={addUserForm.password} onChange={e => setAddUserForm({
                ...addUserForm,
                password: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval PIN (4 digits)
                  </label>
                  <input type="password" maxLength={10} placeholder="e.g. 1234" value={addUserForm.pin_code} onChange={e => setAddUserForm({
                ...addUserForm,
                pin_code: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Monthly Salary (PKR)</label>
                  <input type="number" min="0" placeholder="30000" value={addUserForm.base_salary} onChange={e => setAddUserForm({
                ...addUserForm,
                base_salary: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Flat Commission / Car (PKR)</label>
                  <input type="number" min="0" placeholder="150" value={addUserForm.flat_commission} onChange={e => setAddUserForm({
                ...addUserForm,
                flat_commission: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">% Commission Rate</label>
                  <input type="number" min="0" max="100" placeholder="0" value={addUserForm.commission_rate} onChange={e => setAddUserForm({
                ...addUserForm,
                commission_rate: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsAddUserOpen(false)} className="btn btn-secondary px-4 py-2 text-sm rounded-lg" disabled={isActionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2" disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>}

      {/* Modal: Reset Password */}
      {resetPasswordModal && <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Reset Password: {resetPasswordModal.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              The new password will be hashed securely before being stored in the database.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input type="password" required placeholder="Enter new password (min 8 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setResetPasswordModal(null)} className="btn btn-secondary px-4 py-2 text-sm rounded-lg" disabled={isActionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2" disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>}

      {/* Modal: Update PIN */}
      {updatePinModal && <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-600" />
              Manage Approval PIN: {updatePinModal.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Approval PINs authorize discounts, overrides, and credit note refunds. Stored as a secure salted hash.
            </p>

            <form onSubmit={handleUpdatePin} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Approval PIN (4–6 digits) <span className="text-red-500">*</span>
                </label>
                <input type="password" maxLength={10} required placeholder="e.g. 4321" value={newPin} onChange={e => setNewPin(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-purple-600 focus:outline-none font-mono" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setUpdatePinModal(null)} className="btn btn-secondary px-4 py-2 text-sm rounded-lg" disabled={isActionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2 bg-purple-600 hover:bg-purple-700" disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>}

      {/* Modal: Edit User Details */}
      {editUserModal && <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Edit Staff Member: {editUserModal.name}
            </h3>
            <form onSubmit={handleEditUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input type="text" required value={editUserForm.name} onChange={e => setEditUserForm({
              ...editUserForm,
              name: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select value={editUserForm.role} onChange={e => setEditUserForm({
              ...editUserForm,
              role: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none">
                  <option value="Worker">Worker</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Manager">Manager</option>
                  <option value="Investor">Investor (Read-only overview)</option><option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base Salary (PKR)</label>
                <input type="number" min="0" value={editUserForm.base_salary} onChange={e => setEditUserForm({
              ...editUserForm,
              base_salary: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setEditUserModal(null)} className="btn btn-secondary px-4 py-2 text-sm rounded-lg" disabled={isActionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2" disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>}
    </div>;
}
