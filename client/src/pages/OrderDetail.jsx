import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['cad', 'casting', 'filing', 'polish', 'plating', 'final'];

export default function OrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [styleModal, setStyleModal] = useState(false);
  const [styleForm, setStyleForm] = useState({});
  const [generating, setGenerating] = useState('');
  const [tab, setTab] = useState('styles');

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.get(`/orders/${id}`).then(r => r.data) });
  const { data: tpqc } = useQuery({ queryKey: ['tpqc', id], queryFn: () => api.get(`/tp-qc?order_id=${id}`).then(r => r.data) });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/orders/${id}`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['order', id] }); toast.success('Status updated'); }
  });

  const addStyleMutation = useMutation({
    mutationFn: (data) => api.post(`/orders/${id}/styles`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['order', id] }); setStyleModal(false); toast.success('Style added'); }
  });

  const generateChecklist = async (dept) => {
    setGenerating(dept);
    try {
      await api.post('/checklists/generate', { order_id: parseInt(id), department: dept });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success(`${dept} checklist generated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating('');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!order) return <p>Order not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Order: {order.order_ref}</h1>
          <p className="text-gray-500">{order.customer_name} — {order.styles?.length} styles</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-40" value={order.status} onChange={e => statusMutation.mutate(e.target.value)}>
            <option value="open">Open</option>
            <option value="in_production">In Production</option>
            <option value="dispatched">Dispatched</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b">
        {['styles', 'checklists', 'tp-qc'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'styles' ? 'Styles' : t === 'checklists' ? 'Checklists' : 'Third Party QC'}
          </button>
        ))}
      </div>

      {tab === 'styles' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setStyleForm({}); setStyleModal(true); }} className="btn-secondary text-sm">+ Add Style</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-navy text-white">
                <th className="px-3 py-2 text-left">Style Code</th>
                <th className="px-3 py-2 text-left">Dye File</th>
                <th className="px-3 py-2 text-left">Gold KT</th>
                <th className="px-3 py-2 text-left">Colour</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-right">Gross Wt</th>
                <th className="px-3 py-2 text-right">Target Wt</th>
              </tr></thead>
              <tbody>
                {order.styles?.map(s => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{s.vendor_style_code || '-'}</td>
                    <td className="px-3 py-2">{s.dye_file_no || '-'}</td>
                    <td className="px-3 py-2">{s.gold_kt || '-'}</td>
                    <td className="px-3 py-2">{s.gold_colour || '-'}</td>
                    <td className="px-3 py-2">{s.product_type || '-'}</td>
                    <td className="px-3 py-2">{s.size || '-'}</td>
                    <td className="px-3 py-2 text-right">{s.gross_weight || '-'}</td>
                    <td className="px-3 py-2 text-right">{s.target_weight || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.styles?.length === 0 && <p className="text-gray-400 text-center py-4">No styles. Upload an order PDF or add manually.</p>}
        </div>
      )}

      {tab === 'checklists' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {DEPARTMENTS.map(dept => {
              const existing = order.checklists?.find(c => c.department === dept);
              return (
                <div key={dept} className="card text-center">
                  <h3 className="font-medium text-navy capitalize mb-2">{dept}</h3>
                  {existing ? (
                    <Link to={`/checklists/${existing.id}`} className="text-accent hover:underline text-sm">View Checklist ({existing.status})</Link>
                  ) : (
                    <button onClick={() => generateChecklist(dept)} disabled={!!generating} className="btn-secondary text-sm">
                      {generating === dept ? 'Generating...' : 'Generate'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'tp-qc' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-navy text-white">
                <th className="px-3 py-2 text-left">Style</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2 text-left">Standard</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2 text-left">TP Remarks</th>
                <th className="px-3 py-2 text-left">Date</th>
              </tr></thead>
              <tbody>
                {tpqc?.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2">{r.vendor_style_code || '-'}</td>
                    <td className="px-3 py-2 text-center">{r.qty_sent}</td>
                    <td className="px-3 py-2">{r.standard_reference || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${r.result === 'pass' ? 'bg-green-100 text-green-700' : r.result === 'fail' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.result}</span>
                    </td>
                    <td className="px-3 py-2">{r.tp_remarks || '-'}</td>
                    <td className="px-3 py-2">{r.check_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!tpqc || tpqc.length === 0) && <p className="text-gray-400 text-center py-4">No TP QC results yet.</p>}
        </div>
      )}

      <Modal isOpen={styleModal} onClose={() => setStyleModal(false)} title="Add Style">
        <form onSubmit={e => { e.preventDefault(); addStyleMutation.mutate(styleForm); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Style Code</label><input className="input" value={styleForm.vendor_style_code || ''} onChange={e => setStyleForm({...styleForm, vendor_style_code: e.target.value})} /></div>
            <div><label className="label">Dye File No</label><input className="input" value={styleForm.dye_file_no || ''} onChange={e => setStyleForm({...styleForm, dye_file_no: e.target.value})} /></div>
            <div><label className="label">Gold KT</label><input className="input" value={styleForm.gold_kt || ''} onChange={e => setStyleForm({...styleForm, gold_kt: e.target.value})} /></div>
            <div><label className="label">Gold Colour</label><input className="input" value={styleForm.gold_colour || ''} onChange={e => setStyleForm({...styleForm, gold_colour: e.target.value})} /></div>
            <div><label className="label">Product Type</label><input className="input" value={styleForm.product_type || ''} onChange={e => setStyleForm({...styleForm, product_type: e.target.value})} /></div>
            <div><label className="label">Size</label><input className="input" value={styleForm.size || ''} onChange={e => setStyleForm({...styleForm, size: e.target.value})} /></div>
            <div><label className="label">Gross Weight</label><input className="input" type="number" step="0.001" value={styleForm.gross_weight || ''} onChange={e => setStyleForm({...styleForm, gross_weight: e.target.value})} /></div>
            <div><label className="label">Target Weight</label><input className="input" type="number" step="0.001" value={styleForm.target_weight || ''} onChange={e => setStyleForm({...styleForm, target_weight: e.target.value})} /></div>
          </div>
          <div><label className="label">Portal URL</label><input className="input" value={styleForm.portal_design_url || ''} onChange={e => setStyleForm({...styleForm, portal_design_url: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full">Add Style</button>
        </form>
      </Modal>
    </div>
  );
}
