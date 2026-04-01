import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['cad', 'casting', 'filing', 'polish', 'plating', 'final'];
const DEPT_COLORS = { cad: 'bg-blue-500', casting: 'bg-orange-500', filing: 'bg-teal-500', polish: 'bg-green-500', plating: 'bg-red-500', final: 'bg-navy' };

export default function OrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('styles');
  const [styleModal, setStyleModal] = useState(false);
  const [styleForm, setStyleForm] = useState({});
  const [editingStyle, setEditingStyle] = useState(null);
  const [generating, setGenerating] = useState('');
  const [tpqcForm, setTpqcForm] = useState(null);
  const [reparsing, setReparsing] = useState(false);

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.get(`/orders/${id}`).then(r => r.data) });
  const { data: tpqc } = useQuery({ queryKey: ['tpqc', id], queryFn: () => api.get(`/tp-qc?order_id=${id}`).then(r => r.data) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['order', id] });
  const invalidateTPQC = () => queryClient.invalidateQueries({ queryKey: ['tpqc', id] });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/orders/${id}`, { status }),
    onSuccess: () => { invalidate(); toast.success('Status updated'); }
  });

  const addStyleMutation = useMutation({
    mutationFn: (data) => api.post(`/orders/${id}/styles`, data),
    onSuccess: () => { invalidate(); setStyleModal(false); setStyleForm({}); toast.success('Style added'); }
  });

  const updateStyleMutation = useMutation({
    mutationFn: ({ styleId, ...data }) => api.put(`/orders/${id}/styles/${styleId}`, data),
    onSuccess: () => { invalidate(); setEditingStyle(null); toast.success('Style updated'); }
  });

  const addTPQCMutation = useMutation({
    mutationFn: (data) => api.post('/tp-qc', data),
    onSuccess: () => { invalidateTPQC(); setTpqcForm(null); toast.success('QC result recorded'); }
  });

  const generateChecklist = async (dept) => {
    setGenerating(dept);
    try {
      await api.post('/checklists/generate', { order_id: parseInt(id), department: dept });
      invalidate();
      toast.success(`${dept} checklist generated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally { setGenerating(''); }
  };

  const reparseStyles = async () => {
    setReparsing(true);
    try {
      await api.post(`/orders/${id}/reparse`);
      invalidate();
      toast.success('Styles re-parsed from PDF');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Parse failed');
    } finally { setReparsing(false); }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!order) return <p>Order not found</p>;

  return (
    <div>
      {/* Order Header */}
      <div className="card mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{order.order_ref}</h1>
            <p className="text-gray-500 text-sm">{order.customer_name} — {order.styles?.length || 0} styles — Created {new Date(order.created_at).toLocaleDateString()}</p>
            {order.remarks && <p className="text-sm text-gray-400 mt-1">{order.remarks}</p>}
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-40 text-sm" value={order.status} onChange={e => statusMutation.mutate(e.target.value)}>
              <option value="open">Open</option>
              <option value="in_production">In Production</option>
              <option value="dispatched">Dispatched</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[{ key: 'styles', label: `Styles (${order.styles?.length || 0})` }, { key: 'checklists', label: 'Checklists' }, { key: 'tpqc', label: 'Third Party QC' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STYLES TAB */}
      {tab === 'styles' && (
        <div>
          <div className="flex justify-between mb-3 gap-2">
            <div className="flex gap-2">
              <button onClick={() => { setStyleForm({}); setStyleModal(true); }} className="btn-secondary text-sm">+ Add Style</button>
              {order.file_path && (
                <button onClick={reparseStyles} disabled={reparsing} className="btn-primary text-sm">
                  {reparsing ? 'Parsing...' : 'Parse from PDF'}
                </button>
              )}
            </div>
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
                <th className="px-3 py-2 text-center">Action</th>
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
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setEditingStyle(s); setStyleForm({...s}); }} className="text-xs text-accent hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!order.styles || order.styles.length === 0) && <p className="text-gray-400 text-center py-6">No styles yet. Add manually or parse from order PDF.</p>}
        </div>
      )}

      {/* CHECKLISTS TAB */}
      {tab === 'checklists' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DEPARTMENTS.map(dept => {
            const existing = order.checklists?.find(c => c.department === dept);
            return (
              <div key={dept} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${DEPT_COLORS[dept]}`}></div>
                  <h3 className="font-semibold text-navy capitalize text-sm">{dept} QC</h3>
                </div>
                {existing ? (
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      existing.status === 'finalised' ? 'bg-green-100 text-green-700' :
                      existing.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      existing.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{existing.status}</span>
                    <Link to={`/checklists/${existing.id}`} className="block mt-2 text-accent hover:underline text-sm">View Checklist</Link>
                  </div>
                ) : (
                  <button onClick={() => generateChecklist(dept)} disabled={!!generating}
                    className="btn-secondary text-xs w-full">
                    {generating === dept ? 'AI generating...' : 'Generate'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TP QC TAB */}
      {tab === 'tpqc' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-navy">Third Party QC Results</h2>
            <div className="flex gap-2">
              <button onClick={() => setTpqcForm({ order_id: id, style_id: '', qty_sent: '', standard_reference: '', checked_by_tp: '', check_date: '', result: '', tp_remarks: '', corrective_action: '' })}
                className="btn-primary text-sm">+ Add QC Result</button>
              <a href={`/api/tp-qc/corrective-measures/${id}/pdf`} target="_blank" className="btn-secondary text-sm">Corrective Measures PDF</a>
            </div>
          </div>

          {/* Add TPQC Form */}
          {tpqcForm && (
            <div className="card mb-4 border-2 border-accent/30">
              <h3 className="text-sm font-semibold text-navy mb-3">Record QC Result</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="label">Style</label>
                  <select className="input" value={tpqcForm.style_id} onChange={e => setTpqcForm({...tpqcForm, style_id: e.target.value})}>
                    <option value="">Select style...</option>
                    {order.styles?.map(s => <option key={s.id} value={s.id}>{s.vendor_style_code || `Style #${s.id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Qty Sent</label>
                  <input className="input" type="number" value={tpqcForm.qty_sent} onChange={e => setTpqcForm({...tpqcForm, qty_sent: e.target.value})} />
                </div>
                <div>
                  <label className="label">Standard / Spec Checked</label>
                  <input className="input" value={tpqcForm.standard_reference} onChange={e => setTpqcForm({...tpqcForm, standard_reference: e.target.value})} />
                </div>
                <div>
                  <label className="label">TP QC Person</label>
                  <input className="input" value={tpqcForm.checked_by_tp} onChange={e => setTpqcForm({...tpqcForm, checked_by_tp: e.target.value})} />
                </div>
                <div>
                  <label className="label">Check Date</label>
                  <input className="input" type="date" value={tpqcForm.check_date} onChange={e => setTpqcForm({...tpqcForm, check_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Result *</label>
                  <div className="flex gap-1 mt-1">
                    {[{ v: 'pass', label: 'PASS', color: 'bg-green-500' }, { v: 'fail', label: 'FAIL', color: 'bg-red-500' }, { v: 'rework', label: 'REWORK', color: 'bg-orange-500' }].map(r => (
                      <button key={r.v} onClick={() => setTpqcForm({...tpqcForm, result: r.v})}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                          tpqcForm.result === r.v ? `${r.color} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>{r.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">TP Remarks</label>
                  <textarea className="input" rows={2} value={tpqcForm.tp_remarks} onChange={e => setTpqcForm({...tpqcForm, tp_remarks: e.target.value})} />
                </div>
                <div>
                  <label className="label">Corrective Action</label>
                  <textarea className="input" rows={2} value={tpqcForm.corrective_action} onChange={e => setTpqcForm({...tpqcForm, corrective_action: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addTPQCMutation.mutate(tpqcForm)} disabled={!tpqcForm.result} className="btn-primary text-sm">Save Result</button>
                <button onClick={() => setTpqcForm(null)} className="text-sm text-gray-500">Cancel</button>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-navy text-white">
                <th className="px-3 py-2 text-left">Style</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-left">Standard</th>
                <th className="px-3 py-2 text-center">Result</th>
                <th className="px-3 py-2 text-left">TP Remarks</th>
                <th className="px-3 py-2 text-left">Corrective Action</th>
                <th className="px-3 py-2 text-center">Date</th>
                <th className="px-3 py-2 text-center">PDF</th>
              </tr></thead>
              <tbody>
                {tpqc?.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.vendor_style_code || '-'}</td>
                    <td className="px-3 py-2 text-center">{r.qty_sent || '-'}</td>
                    <td className="px-3 py-2">{r.standard_reference || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        r.result === 'pass' ? 'bg-green-100 text-green-700' :
                        r.result === 'fail' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{r.result?.toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.tp_remarks || '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.corrective_action || '-'}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.check_date || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <a href={`/api/tp-qc/${r.id}/pdf`} target="_blank" className="text-accent hover:underline text-xs">Print</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!tpqc || tpqc.length === 0) && <p className="text-gray-400 text-center py-6">No TP QC results yet.</p>}
        </div>
      )}

      {/* ADD STYLE MODAL */}
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
          <button type="submit" className="btn-primary w-full">Add Style</button>
        </form>
      </Modal>

      {/* EDIT STYLE DRAWER */}
      {editingStyle && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setEditingStyle(null)}>
          <div className="bg-black/30 absolute inset-0" />
          <div className="relative bg-white w-full max-w-md shadow-2xl overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b bg-navy text-white flex items-center justify-between">
              <h2 className="font-semibold">Edit Style: {editingStyle.vendor_style_code || `#${editingStyle.id}`}</h2>
              <button onClick={() => setEditingStyle(null)} className="text-white/70 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Style Code</label><input className="input" value={styleForm.vendor_style_code || ''} onChange={e => setStyleForm({...styleForm, vendor_style_code: e.target.value})} /></div>
              <div><label className="label">Dye File No</label><input className="input" value={styleForm.dye_file_no || ''} onChange={e => setStyleForm({...styleForm, dye_file_no: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Gold KT</label><input className="input" value={styleForm.gold_kt || ''} onChange={e => setStyleForm({...styleForm, gold_kt: e.target.value})} /></div>
                <div><label className="label">Gold Colour</label><input className="input" value={styleForm.gold_colour || ''} onChange={e => setStyleForm({...styleForm, gold_colour: e.target.value})} /></div>
              </div>
              <div><label className="label">Product Type</label><input className="input" value={styleForm.product_type || ''} onChange={e => setStyleForm({...styleForm, product_type: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Size</label><input className="input" value={styleForm.size || ''} onChange={e => setStyleForm({...styleForm, size: e.target.value})} /></div>
                <div><label className="label">Gross Weight</label><input className="input" type="number" step="0.001" value={styleForm.gross_weight || ''} onChange={e => setStyleForm({...styleForm, gross_weight: e.target.value})} /></div>
              </div>
              <div><label className="label">Target Weight</label><input className="input" type="number" step="0.001" value={styleForm.target_weight || ''} onChange={e => setStyleForm({...styleForm, target_weight: e.target.value})} /></div>
              <div>
                <label className="label">Portal Design URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={styleForm.portal_design_url || ''} onChange={e => setStyleForm({...styleForm, portal_design_url: e.target.value})} placeholder="https://..." />
                  {styleForm.portal_design_url && (
                    <a href={styleForm.portal_design_url} target="_blank" className="btn-secondary text-xs whitespace-nowrap">Open</a>
                  )}
                </div>
              </div>
              <div><label className="label">Remarks</label><textarea className="input" rows={2} value={styleForm.remarks || ''} onChange={e => setStyleForm({...styleForm, remarks: e.target.value})} /></div>
              <div>
                <label className="label">Sample Image</label>
                {styleForm.sample_image_path && (
                  <img src={styleForm.sample_image_path} alt="Sample" className="w-24 h-24 object-cover rounded border mb-2" />
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-accent hover:underline">
                  {styleForm.sample_image_path ? 'Change Image' : 'Upload Sample Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                      const res = await api.post(`/orders/${id}/styles/${editingStyle.id}/image`, formData);
                      setStyleForm({...styleForm, sample_image_path: res.data.image_path});
                      toast.success('Image uploaded');
                    } catch { toast.error('Image upload failed'); }
                  }} />
                </label>
              </div>
              <button onClick={() => updateStyleMutation.mutate({ styleId: editingStyle.id, ...styleForm })}
                className="btn-primary w-full" disabled={updateStyleMutation.isPending}>
                {updateStyleMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
