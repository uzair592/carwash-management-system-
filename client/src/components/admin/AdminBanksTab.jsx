import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  DollarSign,
  Wallet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  History,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import axios from 'axios';

const money = (val) => Number(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function AdminBanksTab() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [totalBankLedger, setTotalBankLedger] = useState(0);
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add / Edit Account Modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({
    bank_name: '',
    account_title: '',
    account_number: '',
    initial_balance: '0',
    is_active: true,
  });

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    transfer_type: 'CASH_TO_BANK',
    from_bank_account_id: '',
    to_bank_account_id: '',
    amount: '',
    notes: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [bankRes, txRes] = await Promise.all([
        axios.get('/api/banks?include_inactive=true'),
        axios.get('/api/ledger/transfers'),
      ]);
      setBankAccounts(bankRes.data?.data?.accounts || []);
      setCashBalance(bankRes.data?.data?.cash_balance || 0);
      setTotalBankLedger(bankRes.data?.data?.total_bank_ledger || 0);
      setTransfers(txRes.data?.data || []);
    } catch (err) {
      setErrorMsg('Failed to load bank accounts and transfers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      bank_name: '',
      account_title: '',
      account_number: '',
      initial_balance: '0',
      is_active: true,
    });
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (acc) => {
    setEditingAccount(acc);
    setAccountForm({
      bank_name: acc.bank_name,
      account_title: acc.account_title,
      account_number: acc.account_number,
      initial_balance: String(acc.current_balance),
      is_active: acc.is_active,
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.bank_name.trim() || !accountForm.account_title.trim() || !accountForm.account_number.trim()) {
      setErrorMsg('Bank Name, Account Title, and Account Number are required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      if (editingAccount) {
        await axios.put(`/api/banks/${editingAccount.id}`, {
          bank_name: accountForm.bank_name.trim(),
          account_title: accountForm.account_title.trim(),
          account_number: accountForm.account_number.trim(),
          is_active: accountForm.is_active,
        });
        setSuccessMsg(`Bank account "${accountForm.bank_name}" updated.`);
      } else {
        await axios.post('/api/banks', {
          bank_name: accountForm.bank_name.trim(),
          account_title: accountForm.account_title.trim(),
          account_number: accountForm.account_number.trim(),
          initial_balance: parseFloat(accountForm.initial_balance) || 0,
        });
        setSuccessMsg(`Bank account "${accountForm.bank_name}" added successfully.`);
      }

      setIsAccountModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save bank account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (acc) => {
    if (!window.confirm(`Are you sure you want to remove or deactivate "${acc.bank_name}"?`)) return;
    try {
      const res = await axios.delete(`/api/banks/${acc.id}`);
      if (res.data?.status === 'deactivated') {
        setSuccessMsg(res.data.message);
      } else {
        setSuccessMsg('Bank account deleted.');
      }
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to remove bank account.');
    }
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) {
      setErrorMsg('Transfer amount must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await axios.post('/api/ledger/transfer', {
        transfer_type: transferForm.transfer_type,
        amount: amt,
        from_bank_account_id: transferForm.from_bank_account_id || undefined,
        to_bank_account_id: transferForm.to_bank_account_id || undefined,
        notes: transferForm.notes,
      });

      setSuccessMsg(`Transferred Rs. ${amt.toLocaleString()} successfully.`);
      setIsTransferModalOpen(false);
      setTransferForm({
        transfer_type: 'CASH_TO_BANK',
        from_bank_account_id: '',
        to_bank_account_id: '',
        amount: '',
        notes: '',
      });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Transfer failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeBanks = bankAccounts.filter((b) => b.is_active);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            Multiple Bank Accounts & Transfers
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Maintain independent ledger balances for business bank accounts, route electronic payments at checkout, and execute balanced cash-to-bank, bank-to-cash, or bank-to-bank transfers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="btn btn-secondary flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border border-slate-300"
          >
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            Transfer Funds
          </button>
          <button
            onClick={openAddAccount}
            className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Bank Account
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="form-error flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
          <button className="ml-auto text-xs underline" onClick={() => setErrorMsg('')}>Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="status-badge success flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Physical Cash Drawer</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            Rs. {money(cashBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Physical shop register cash</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Bank Ledger Vault</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            Rs. {money(totalBankLedger)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Sum of all bank deposits & transfers</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Configured Bank Accounts</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {activeBanks.length} Active Accounts
          </p>
          <p className="text-xs text-slate-400 mt-1">{bankAccounts.length} total in system</p>
        </div>
      </div>

      {/* Bank Accounts Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
          <span>Business Bank Accounts</span>
          <span className="text-xs text-slate-400 font-normal">Selectable during checkout for bank collections</span>
        </h3>

        {isLoading ? (
          <div className="py-8 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            Loading bank accounts...
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            No bank accounts configured. Click "Add Bank Account" above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankAccounts.map((acc) => (
              <div
                key={acc.id}
                className={`p-4 rounded-xl border transition ${
                  acc.is_active ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-100/60 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    {acc.bank_name}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      acc.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {acc.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1 mb-3">
                  <div><strong>Title:</strong> {acc.account_title}</div>
                  <div className="font-mono text-slate-600"><strong>IBAN/No:</strong> {acc.account_number}</div>
                  <div className="text-[11px] text-slate-400">
                    {acc._count?.payments || 0} payments · {acc._count?.transfers_from + acc._count?.transfers_to || 0} transfers
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Ledger Balance</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      Rs. {money(acc.current_balance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditAccount(acc)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded"
                      title="Edit Account Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                      title="Deactivate / Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Ledger Transfers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            Recent Internal Fund Transfers
          </h3>
          <span className="text-xs text-slate-400">P&L Neutral • Zero double-entry imbalance</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">From Source</th>
                <th className="py-3 px-4">To Destination</th>
                <th className="py-3 px-4 text-right">Amount (PKR)</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-400">
                    No internal transfers recorded yet.
                  </td>
                </tr>
              ) : (
                transfers.slice(0, 15).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/75">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        {t.transfer_type || 'TRANSFER'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {t.from_bank_account
                        ? `${t.from_bank_account.bank_name} (${t.from_bank_account.account_number.slice(-4)})`
                        : t.from_account?.replace('_', ' ') || 'Cash Drawer'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {t.to_bank_account
                        ? `${t.to_bank_account.bank_name} (${t.to_bank_account.account_number.slice(-4)})`
                        : t.to_account?.replace('_', ' ') || 'Main Bank'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      Rs. {money(t.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {t.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Bank Account */}
      {isAccountModalOpen && (
        <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-600" />
              {editingAccount ? 'Edit Bank Account' : 'Add Business Bank Account'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meezan Bank, Bank Alfalah, HBL"
                  value={accountForm.bank_name}
                  onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DF PRO Auto Care Main"
                  value={accountForm.account_title}
                  onChange={(e) => setAccountForm({ ...accountForm, account_title: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Number / IBAN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PK64MEZN0001234567890101"
                  value={accountForm.account_number}
                  onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Balance (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={accountForm.initial_balance}
                    onChange={(e) => setAccountForm({ ...accountForm, initial_balance: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              )}

              {editingAccount && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={accountForm.is_active ? 'true' : 'false'}
                    onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.value === 'true' })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="true">Active (Available at Checkout)</option>
                    <option value="false">Deactivated (Hidden from Checkout)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-sm rounded-lg"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2"
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingAccount ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Funds */}
      {isTransferModalOpen && (
        <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              Internal Vault & Bank Transfer
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Transfers maintain exact double-entry balance and do not affect profit & loss.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Route</label>
                <select
                  value={transferForm.transfer_type}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      transfer_type: e.target.value,
                      from_bank_account_id: '',
                      to_bank_account_id: '',
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-purple-600 focus:outline-none"
                >
                  <option value="CASH_TO_BANK">Cash Drawer ➔ Business Bank Account</option>
                  <option value="BANK_TO_CASH">Business Bank Account ➔ Cash Drawer</option>
                  <option value="BANK_TO_BANK">Bank Account A ➔ Bank Account B</option>
                </select>
              </div>

              {/* Source Bank Selector if applicable */}
              {(transferForm.transfer_type === 'BANK_TO_CASH' || transferForm.transfer_type === 'BANK_TO_BANK') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    From Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={transferForm.from_bank_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_bank_account_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-purple-600 focus:outline-none"
                  >
                    <option value="">-- Select Source Bank Account --</option>
                    {activeBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} - Balance: Rs. {money(b.current_balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Bank Selector if applicable */}
              {(transferForm.transfer_type === 'CASH_TO_BANK' || transferForm.transfer_type === 'BANK_TO_BANK') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    To Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={transferForm.to_bank_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_bank_account_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-purple-600 focus:outline-none"
                  >
                    <option value="">-- Select Destination Bank Account --</option>
                    {activeBanks
                      .filter((b) => b.id !== transferForm.from_bank_account_id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - Current: Rs. {money(b.current_balance)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount in PKR <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="e.g. 25000"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-purple-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Daily cash deposit to Meezan Bank"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-sm rounded-lg"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
