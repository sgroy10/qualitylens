import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Orders() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState({ customer_id: '', status: '' });
  const [form, setForm] = useState({ customer_id: '', order_ref: '', remarks: '' });
  const [file, setFile] = useState(null);

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) });
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.customer_id) params.append('customer_id', filter.customer_id);
      if (filter.status) params.append('status', filter.status);
      return api.get(`/orders?${params}`).then(r => r.data);
    }
  });

  const createMutation = useMutation({
    mutationFn: (formData) => api.post('/orders', formData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setModalOpen(false); toast.success('Order created'); }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('customer_id', form.customer_id);
    formData.append('order_ref', form.order_ref);
    formData.append('remarks', form.remarks);
    if (file) formData.append('file', file);
    createMutation.mutate(formData);
  };

  const statusColors = { open: 'bg-blue-100 text-blue-700', in_production: 'bg-yellow-100 text-yellow-700', dispatched: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700' };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Orders</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ New Order</button>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="input w-48" value={filter.customer_id} onChange={e => setFilter({...filter, customer_id: e.target.value})}>
          <option value="">All Customers</option>
          {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-40" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_production">In Production</option>
          <option value="dispatched">Dispatched</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="space-y-3">
        {orders?.map(o => (
          <Link key={o.id} to={`/orders/${o.id}`} className="card block hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-navy">{o.order_ref}</h3>
                <p className="text-sm text-gray-500">{o.customer_name} — {o.style_count} styles</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${statusColors[o.status]}`}>{o.status}</span>
                <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </Link>
        ))}
        {orders?.length === 0 && <p className="text-gray-400 text-center py-8">No orders yet.</p>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Order">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">Customer *</label>
            <select className="input" value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} required>
              <option value="">Select...</option>
              {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Order Reference *</label><input className="input" value={form.order_ref} onChange={e => setForm({...form, order_ref: e.target.value})} required /></div>
          <div><label className="label">Order PDF</label><input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} className="input" /></div>
          <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Order'}</button>
        </form>
      </Modal>
    </div>
  );
}
