import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, CheckCircle, XCircle, Clock, DollarSign, Package, Layers, AlertCircle, Loader2, Search } from 'lucide-react';
import axios from 'axios';
const money = val => Number(val || 0).toLocaleString('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
export default function AdminServicesTab({
  onRefreshNeeded
}) {
  const {
    can
  } = useAuth();
  const [services, setServices] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Wash',
    price: '',
    estimated_time: '30',
    is_active: true,
    linked_inventory_id: '',
    inventory_deduction_amount: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [srvRes, invRes] = await Promise.all([axios.get('/api/services?include_inactive=true'), can('inventory.read') ? axios.get('/api/inventory') : Promise.resolve({
        data: {
          data: []
        }
      })]);
      setServices(srvRes.data?.data || []);
      setInventoryList(invRes.data?.data || []);
    } catch (err) {
      setErrorMsg('Failed to load services catalog. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);
  const openAddModal = () => {
    setEditingService(null);
    setForm({
      name: '',
      category: 'Wash',
      price: '',
      estimated_time: '30',
      is_active: true,
      linked_inventory_id: '',
      inventory_deduction_amount: ''
    });
    setIsModalOpen(true);
  };
  const openEditModal = service => {
    setEditingService(service);
    setForm({
      name: service.name,
      category: service.category,
      price: String(service.price),
      estimated_time: String(service.estimated_time || 30),
      is_active: service.is_active,
      linked_inventory_id: service.linked_inventory_id || '',
      inventory_deduction_amount: service.inventory_deduction_amount ? String(service.inventory_deduction_amount) : ''
    });
    setIsModalOpen(true);
  };
  const handleSave = async e => {
    e.preventDefault();
    if (!form.name.trim() || form.price === '') {
      setErrorMsg('Service name and price are required.');
      return;
    }
    setIsSaving(true);
    setErrorMsg('');
    try {
      if (editingService) {
        await axios.put(`/api/services/${editingService.id}`, {
          name: form.name.trim(),
          category: form.category,
          price: parseFloat(form.price),
          estimated_time: parseInt(form.estimated_time, 10) || 30,
          is_active: form.is_active,
          linked_inventory_id: form.linked_inventory_id || null,
          inventory_deduction_amount: form.inventory_deduction_amount ? parseFloat(form.inventory_deduction_amount) : null
        });
        setSuccessMsg(`Service "${form.name}" updated successfully. Price changes apply to future selections.`);
      } else {
        await axios.post('/api/services', {
          name: form.name.trim(),
          category: form.category,
          price: parseFloat(form.price),
          estimated_time: parseInt(form.estimated_time, 10) || 30,
          linked_inventory_id: form.linked_inventory_id || null,
          inventory_deduction_amount: form.inventory_deduction_amount ? parseFloat(form.inventory_deduction_amount) : null
        });
        setSuccessMsg(`Service "${form.name}" created successfully.`);
      }
      setIsModalOpen(false);
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save service.');
    } finally {
      setIsSaving(false);
    }
  };
  const toggleServiceStatus = async service => {
    try {
      await axios.put(`/api/services/${service.id}`, {
        is_active: !service.is_active
      });
      await loadData();
    } catch (err) {
      setErrorMsg('Failed to update service status.');
    }
  };
  const filteredServices = services.filter(s => {
    const matchesCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });
  return <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Services & Pricing Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure independent pricing, categories, durations, and consumable yield links. Price changes apply to future jobs; past invoices remain immutable.
          </p>
        </div>
        <button disabled={!can('services.manage')} onClick={openAddModal} className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-sm">
          <Plus className="w-4 h-4" />
          Add New Service
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category:</span>
          {['ALL', 'Wash', 'Detailing', 'PPF'].map(cat => <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${categoryFilter === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>)}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input type="text" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Services Grid (Requirement 3: Selectable/Manageable Service Blocks) */}
      {isLoading ? <div className="empty-state py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-base text-slate-600">Loading services catalog...</p>
        </div> : filteredServices.length === 0 ? <div className="empty-state py-12 bg-white rounded-xl border border-slate-200">
          <Package className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-base font-semibold text-slate-700">No services found</p>
          <p className="text-sm text-slate-500 mt-1">Try another category filter or add a new service.</p>
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServices.map(service => <div key={service.id} className={`surface p-5 rounded-xl border transition-all hover:shadow-md flex flex-col justify-between ${service.is_active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/70 opacity-75'}`}>
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${service.category === 'Wash' ? 'bg-blue-100 text-blue-800' : service.category === 'Detailing' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {service.category}
                  </span>
                  <button disabled={!can('services.manage')} onClick={() => toggleServiceStatus(service)} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${service.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`} title="Click to toggle active status">
                    {service.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {service.is_active ? 'Active' : 'Deactivated'}
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mt-2 mb-1">{service.name}</h3>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    ~{service.estimated_time || 30} mins
                  </span>
                  {service.linked_inventory && <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      <Layers className="w-3.5 h-3.5" />
                      {service.inventory_deduction_amount} {service.linked_inventory.unit_type} of {service.linked_inventory.item_name}
                    </span>}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Standard Price</span>
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    Rs. {money(service.price)}
                  </span>
                </div>
                <button disabled={!can('services.manage')} onClick={() => openEditModal(service)} className="btn btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                  <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                  Edit Service
                </button>
              </div>
            </div>)}
        </div>}

      {/* Modal Add / Edit Service */}
      {isModalOpen && <div className="dialog-backdrop">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              {editingService ? `Edit Service: ${editingService.name}` : 'Add New Service to Catalog'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <input type="text" required placeholder="e.g. Full Body Wash or Outer Body Wash" value={form.name} onChange={e => setForm({
              ...form,
              name: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({
                ...form,
                category: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none">
                    <option value="Wash">Wash</option>
                    <option value="Detailing">Detailing</option>
                    <option value="PPF">PPF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price in PKR <span className="text-red-500">*</span>
                  </label>
                  <input type="number" step="0.01" min="0" required placeholder="e.g. 1500" value={form.price} onChange={e => setForm({
                ...form,
                price: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Time (Mins)</label>
                  <input type="number" min="5" placeholder="30" value={form.estimated_time} onChange={e => setForm({
                ...form,
                estimated_time: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select value={form.is_active ? 'true' : 'false'} onChange={e => setForm({
                ...form,
                is_active: e.target.value === 'true'
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none">
                    <option value="true">Active (Available for Intake)</option>
                    <option value="false">Deactivated (Hidden from Intake)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Linked Consumable Inventory (Optional Yield Deduction)
                </label>
                <select value={form.linked_inventory_id} onChange={e => setForm({
              ...form,
              linked_inventory_id: e.target.value
            })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-600 focus:outline-none mb-2">
                  <option value="">No inventory tied</option>
                  {inventoryList.map(item => <option key={item.id} value={item.id}>
                      {item.item_name} ({item.unit_type}) - Stock: {item.current_stock}
                    </option>)}
                </select>

                {form.linked_inventory_id && <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deduction Amount per Job
                    </label>
                    <input type="number" step="0.01" min="0" placeholder="e.g. 30 (ML)" value={form.inventory_deduction_amount} onChange={e => setForm({
                ...form,
                inventory_deduction_amount: e.target.value
              })} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-600 focus:outline-none" />
                  </div>}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary px-4 py-2 text-sm rounded-lg" disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-5 py-2 text-sm rounded-lg flex items-center gap-2" disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>}
    </div>;
}
