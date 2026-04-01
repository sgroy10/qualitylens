import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Customers() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', portal_url: '', contact_name: '', contact_email: '', notes: '' });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers').then(r => r.data)
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? api.put(`/customers/${editing.id}`, data) : api.post('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
      setEditing(null);
      toast.success(editing ? 'Customer updated' : 'Customer created');
    },
    onError: () => toast.error('Failed to save customer')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    }
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', portal_url: '', contact_name: '', contact_email: '', notes: '' }); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm(c); setModalOpen(true); };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Customers</h1>
        <button onClick={openCreate} className="btn-primary">+ Add Customer</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers?.map(c => (
          <div key={c.id} className="card hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-navy text-lg">{c.name}</h3>
                {c.contact_name && <p className="text-sm text-gray-500 mt-1">{c.contact_name}</p>}
                {c.contact_email && <p className="text-sm text-gray-400">{c.contact_email}</p>}
                {c.notes && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{c.notes}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="text-accent hover:underline text-sm">Edit</button>
                <button onClick={() => setDeleteId(c.id)} className="text-red-500 hover:underline text-sm ml-2">Del</button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to={`/manuals?customer=${c.id}`} className="text-xs text-accent hover:underline">View Manuals</Link>
            </div>
          </div>
        ))}
        {customers?.length === 0 && <p className="text-gray-400 col-span-3 text-center py-8">No customers yet. Add one to get started.</p>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="label">Portal URL</label><input className="input" value={form.portal_url || ''} onChange={e => setForm({...form, portal_url: e.target.value})} /></div>
          <div><label className="label">Contact Name</label><input className="input" value={form.contact_name || ''} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
          <div><label className="label">Contact Email</label><input className="input" type="email" value={form.contact_email || ''} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</button>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteMutation.mutate(deleteId)} title="Delete Customer" message="Are you sure? This will also delete associated manuals and data." />
    </div>
  );
}
