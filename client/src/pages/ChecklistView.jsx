import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ChecklistView() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ check_point: '', specification: '', verification_method: '', manual_page_ref: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['checklist', id],
    queryFn: () => api.get(`/checklists/${id}`).then(r => r.data)
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['checklist', id] });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, ...data }) => api.put(`/checklists/${id}/items/${itemId}`, data),
    onSuccess: invalidate
  });

  const addItemMutation = useMutation({
    mutationFn: (data) => api.post(`/checklists/${id}/items`, data),
    onSuccess: () => { invalidate(); setAddingItem(false); setNewItem({ check_point: '', specification: '', verification_method: '', manual_page_ref: '' }); toast.success('Item added'); }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => api.delete(`/checklists/${id}/items/${itemId}`),
    onSuccess: () => { invalidate(); toast.success('Item removed'); }
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/checklists/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast.success('Status updated'); }
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ itemId, file }) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post(`/checklists/${id}/items/${itemId}/image`, formData);
    },
    onSuccess: () => { invalidate(); toast.success('Image uploaded'); }
  });

  const handlePrint = () => window.open(`/api/checklists/${id}/pdf`, '_blank');

  if (isLoading) return <LoadingSpinner text="Loading checklist..." />;
  if (!checklist) return <p>Checklist not found</p>;

  const isDraft = checklist.status === 'draft' || checklist.status === 'pending';
  const isFinalised = checklist.status === 'finalised';
  const items = checklist.items || [];
  const completed = items.filter(i => i.result).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ check_point: item.check_point, specification: item.specification, verification_method: item.verification_method || '', manual_page_ref: item.manual_page_ref || '' });
  };

  const saveEdit = (itemId) => {
    updateItemMutation.mutate({ itemId, ...editForm });
    setEditingId(null);
  };

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy capitalize">{checklist.department} QC Checklist</h1>
          <p className="text-gray-500 text-sm">{checklist.customer_name} — {checklist.order_ref}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            isFinalised ? 'bg-green-100 text-green-700' :
            isDraft ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {checklist.status === 'pending' ? 'Draft' : checklist.status}
          </span>
          {isDraft && (
            <button onClick={() => statusMutation.mutate('finalised')} className="btn-primary text-sm">
              Finalise
            </button>
          )}
          {checklist.status === 'in_progress' && (
            <button onClick={() => statusMutation.mutate('finalised')} className="btn-primary text-sm">
              Finalise
            </button>
          )}
          <button onClick={handlePrint} className="btn-secondary text-sm">Print PDF</button>
        </div>
      </div>

      {/* Progress bar */}
      {!isDraft && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Progress</span>
            <span className="text-sm font-medium text-navy">{completed}/{total} ({progress}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-accent rounded-full h-3 transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Add Item (Draft mode) */}
      {isDraft && (
        <div className="mb-4">
          {addingItem ? (
            <div className="card border-2 border-dashed border-accent">
              <h3 className="text-sm font-semibold text-navy mb-3">Add Check Point</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Check Point *</label>
                  <input className="input" value={newItem.check_point} onChange={e => setNewItem({...newItem, check_point: e.target.value})} placeholder="What to check" />
                </div>
                <div>
                  <label className="label">Specification *</label>
                  <input className="input" value={newItem.specification} onChange={e => setNewItem({...newItem, specification: e.target.value})} placeholder="Required spec" />
                </div>
                <div>
                  <label className="label">Verification Method</label>
                  <input className="input" value={newItem.verification_method} onChange={e => setNewItem({...newItem, verification_method: e.target.value})} placeholder="How to verify" />
                </div>
                <div>
                  <label className="label">Manual Page Ref</label>
                  <input className="input" type="number" value={newItem.manual_page_ref} onChange={e => setNewItem({...newItem, manual_page_ref: e.target.value})} placeholder="Page #" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addItemMutation.mutate(newItem)} className="btn-primary text-sm" disabled={!newItem.check_point || !newItem.specification}>Add</button>
                <button onClick={() => setAddingItem(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingItem(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-accent hover:text-accent transition">
              + Add Check Point
            </button>
          )}
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className={`card border-l-4 ${item.result === 'pass' ? 'border-l-green-500' : item.result === 'fail' ? 'border-l-red-500' : item.result === 'na' ? 'border-l-gray-400' : 'border-l-gray-200'}`}>
            {editingId === item.id ? (
              /* EDIT MODE for this item */
              <div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label">Check Point</label>
                    <input className="input" value={editForm.check_point} onChange={e => setEditForm({...editForm, check_point: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Specification</label>
                    <input className="input" value={editForm.specification} onChange={e => setEditForm({...editForm, specification: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Verification Method</label>
                    <input className="input" value={editForm.verification_method} onChange={e => setEditForm({...editForm, verification_method: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Manual Page</label>
                    <input className="input" type="number" value={editForm.manual_page_ref} onChange={e => setEditForm({...editForm, manual_page_ref: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(item.id)} className="btn-primary text-xs">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-navy text-white rounded-full w-6 h-6 flex items-center justify-center font-medium">{item.sequence_no}</span>
                    <h3 className="font-semibold text-navy">{item.check_point}</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-1"><strong>Spec:</strong> {item.specification}</p>
                  {item.verification_method && <p className="text-sm text-gray-500"><strong>Method:</strong> {item.verification_method}</p>}
                  {item.manual_page_ref > 0 && <p className="text-xs text-accent mt-1">Manual Page {item.manual_page_ref}</p>}
                  {(item.image_path || item.reference_image_path) && (
                    <img src={item.image_path || item.reference_image_path} alt="Reference" className="mt-2 h-20 rounded border" />
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* Pass/Fail/NA buttons (only when not draft) */}
                  {!isDraft && (
                    <div className="flex gap-1">
                      {['pass', 'fail', 'na'].map(r => (
                        <button
                          key={r}
                          onClick={() => !isFinalised || !item.result ? updateItemMutation.mutate({ itemId: item.id, result: r, remarks: item.remarks }) : null}
                          disabled={isFinalised && item.result}
                          className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                            item.result === r
                              ? r === 'pass' ? 'bg-green-500 text-white' : r === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } ${isFinalised && item.result ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Remarks (only when not draft) */}
                  {!isDraft && (
                    <input
                      className="input text-xs w-48"
                      placeholder="Remarks..."
                      defaultValue={item.remarks || ''}
                      onBlur={e => {
                        if (e.target.value !== (item.remarks || '')) {
                          updateItemMutation.mutate({ itemId: item.id, result: item.result, remarks: e.target.value });
                        }
                      }}
                    />
                  )}
                  {/* Edit/Delete (only in draft) */}
                  {isDraft && (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(item)} className="text-xs text-accent hover:underline">Edit</button>
                      <label className="text-xs text-accent hover:underline cursor-pointer">
                        Image
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          if (e.target.files[0]) uploadImageMutation.mutate({ itemId: item.id, file: e.target.files[0] });
                        }} />
                      </label>
                      <button onClick={() => { if (confirm('Delete this check point?')) deleteItemMutation.mutate(item.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-gray-400 text-center py-8">No check items yet. Add some above.</p>}
    </div>
  );
}
