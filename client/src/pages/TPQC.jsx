import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function TPQC() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [form, setForm] = useState({ order_id: '', style_id: '', qty_sent: '', standard_reference: '', checked_by_tp: '', check_date: '', result: '', tp_remarks: '', corrective_action: '' });

  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders').then(r => r.data) });
  const { data: results, isLoading } = useQuery({
    queryKey: ['tpqc', selectedOrder],
    queryFn: () => api.get(`/tp-qc${selectedOrder ? `?order_id=${selectedOrder}` : ''}`).then(r => r.data)
  });
  const { data: styles } = useQuery({
    queryKey: ['styles', form.order_id],
    queryFn: () => form.order_id ? api.get(`/orders/${form.order_id}/styles`).then(r => r.data) : Promise.resolve([]),
    enabled: !!form.order_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tp-qc', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tpqc'] }); setModalOpen(false); toast.success('Result recorded'); }
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Third Party QC</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ Add Result</button>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="input w-48" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
          <option value="">All Orders</option>
          {orders?.map(o => <option key={o.id} value={o.id}>{o.order_ref}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-navy text-white">
            <th className="px-3 py-2 text-left">Order</th>
            <th className="px-3 py-2 text-left">Style</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2 text-left">Standard</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2 text-left">Checked By</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">PDF</th>
          </tr></thead>
          <tbody>
            {results?.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">{r.order_ref}</td>
                <td className="px-3 py-2">{r.vendor_style_code || '-'}</td>
                <td className="px-3 py-2 text-center">{r.qty_sent}</td>
                <td className="px-3 py-2">{r.standard_reference || '-'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${r.result === 'pass' ? 'bg-green-100 text-green-700' : r.result === 'fail' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.result}</span>
                </td>
                <td className="px-3 py-2">{r.checked_by_tp || '-'}</td>
                <td className="px-3 py-2 text-center">{r.check_date || '-'}</td>
                <td className="px-3 py-2 text-center">
                  <a href={`/api/tp-qc/${r.id}/pdf`} target="_blank" className="text-accent hover:underline text-xs">Print</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add TP QC Result" wide>
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Order *</label>
              <select className="input" value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value, style_id: ''})} required>
                <option value="">Select...</option>
                {orders?.map(o => <option key={o.id} value={o.id}>{o.order_ref}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Style</label>
              <select className="input" value={form.style_id} onChange={e => setForm({...form, style_id: e.target.value})}>
                <option value="">Select...</option>
                {styles?.map(s => <option key={s.id} value={s.id}>{s.vendor_style_code}</option>)}
              </select>
            </div>
            <div><label className="label">Qty Sent</label><input className="input" type="number" value={form.qty_sent} onChange={e => setForm({...form, qty_sent: e.target.value})} /></div>
            <div><label className="label">Standard/Spec</label><input className="input" value={form.standard_reference} onChange={e => setForm({...form, standard_reference: e.target.value})} /></div>
            <div><label className="label">Checked By (TP)</label><input className="input" value={form.checked_by_tp} onChange={e => setForm({...form, checked_by_tp: e.target.value})} /></div>
            <div><label className="label">Date</label><input className="input" type="date" value={form.check_date} onChange={e => setForm({...form, check_date: e.target.value})} /></div>
            <div>
              <label className="label">Result *</label>
              <select className="input" value={form.result} onChange={e => setForm({...form, result: e.target.value})} required>
                <option value="">Select...</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="rework">Rework</option>
              </select>
            </div>
          </div>
          <div><label className="label">TP Remarks</label><textarea className="input" rows={2} value={form.tp_remarks} onChange={e => setForm({...form, tp_remarks: e.target.value})} /></div>
          <div><label className="label">Corrective Action</label><textarea className="input" rows={2} value={form.corrective_action} onChange={e => setForm({...form, corrective_action: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full">Save Result</button>
        </form>
      </Modal>
    </div>
  );
}
