import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'supervisor', department: '' });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: user?.role === 'admin'
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setModalOpen(false); toast.success('User created'); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed')
  });

  if (user?.role !== 'admin') return <p className="text-gray-500">Admin access required.</p>;
  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ Add User</button>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold text-navy mb-3">Company Profile</h2>
        <p className="text-gray-600">Sky Gold & Diamonds Ltd</p>
        <p className="text-sm text-gray-500">Navi Mumbai, Maharashtra, India</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Users</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="py-2 text-left">Name</th>
            <th className="py-2 text-left">Email</th>
            <th className="py-2 text-left">Role</th>
            <th className="py-2 text-left">Department</th>
          </tr></thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.name}</td>
                <td className="py-2 text-gray-500">{u.email}</td>
                <td className="py-2"><span className="text-xs bg-navy/10 text-navy px-2 py-1 rounded">{u.role}</span></td>
                <td className="py-2">{u.department || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add User">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
          <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="admin">Admin</option>
              <option value="qa_manager">QA Manager</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
              <option value="">None</option>
              <option value="cad">CAD</option>
              <option value="casting">Casting</option>
              <option value="filing">Filing</option>
              <option value="polish">Polish</option>
              <option value="plating">Plating</option>
              <option value="final">Final</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">Create User</button>
        </form>
      </Modal>
    </div>
  );
}
