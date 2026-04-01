import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function NCR() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState({ status: '' });
  const [form, setForm] = useState({ customer_id: '', order_id: '', ncr_ref: '', rejection_category: '', defect_description: '', root_cause: '', corrective_action: '' });

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) });
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders').then(r => r.data) });
  const { data: ncrs, isLoading } = useQuery({
    queryKey: ['ncrs', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      return api.get(`/ncr?${params}`).then(r => r.data);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/ncr', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ncrs'] }); setModalOpen(false); toast.success('NCR created'); }
  });

  const closeMutation = useMutation({
    mutationFn: (id) => api.put(`/ncr/${id}`, { status: 'closed' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ncrs'] }); setDetail(null); toast.success('NCR closed'); }
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">NCR Register</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ New NCR</button>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="input w-40" value={filter.status} onChange={e => setFilter({ status: e.target.value })}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-navy text-white">
            <th className="px-3 py-2 text-left">NCR Ref</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Order</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Date</th>
          </tr></thead>
          <tbody>
            {ncrs?.map(n => (
              <tr key={n.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(n)}>
                <td className="px-3 py-2 font-medium text-accent">{n.ncr_ref}</td>
                <td className="px-3 py-2">{n.customer_name || '-'}</td>
                <td className="px-3 py-2">{n.order_ref || '-'}</td>
                <td className="px-3 py-2">{n.rejection_category || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${n.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{n.status}</span>
                </td>
                <td className="px-3 py-2">{new Date(n.raised_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New NCR" wide>
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">NCR Ref *</label><input className="input" value={form.ncr_ref} onChange={e => setForm({...form, ncr_ref: e.target.value})} required /></div>
            <div>
              <label className="label">Customer</label>
              <select className="input" value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
                <option value="">Select...</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Order</label>
              <select className="input" value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})}>
                <option value="">Select...</option>
                {orders?.map(o => <option key={o.id} value={o.id}>{o.order_ref}</option>)}
              </select>
            </div>
            <div><label className="label">Rejection Category</label><input className="input" value={form.rejection_category} onChange={e => setForm({...form, rejection_category: e.target.value})} /></div>
          </div>
          <div><label className="label">Defect Description</label><textarea className="input" rows={3} value={form.defect_description} onChange={e => setForm({...form, defect_description: e.target.value})} /></div>
          <div><label className="label">Root Cause</label><textarea className="input" rows={2} value={form.root_cause} onChange={e => setForm({...form, root_cause: e.target.value})} /></div>
          <div><label className="label">Corrective Action</label><textarea className="input" rows={2} value={form.corrective_action} onChange={e => setForm({...form, corrective_action: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full">Create NCR</button>
        </form>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`NCR: ${detail?.ncr_ref}`} wide>
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><strong>Customer:</strong> {detail.customer_name || '-'}</div>
              <div><strong>Order:</strong> {detail.order_ref || '-'}</div>
              <div><strong>Category:</strong> {detail.rejection_category || '-'}</div>
              <div><strong>Status:</strong> {detail.status}</div>
            </div>
            <div><strong className="text-sm">Defect:</strong><p className="text-sm text-gray-700">{detail.defect_description || '-'}</p></div>
            <div><strong className="text-sm">Root Cause:</strong><p className="text-sm text-gray-700">{detail.root_cause || '-'}</p></div>
            <div><strong className="text-sm">Corrective Action:</strong><p className="text-sm text-gray-700">{detail.corrective_action || '-'}</p></div>
            {detail.status === 'open' && (
              <button onClick={() => closeMutation.mutate(detail.id)} className="btn-primary w-full">Close NCR</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
