import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ChecklistView() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['checklist', id],
    queryFn: () => api.get(`/checklists/${id}`).then(r => r.data)
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, result, remarks }) => api.put(`/checklists/${id}/items/${itemId}`, { result, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', id] });
    }
  });

  const handlePrint = () => {
    window.open(`/api/checklists/${id}/pdf`, '_blank');
  };

  if (isLoading) return <LoadingSpinner text="Loading checklist..." />;
  if (!checklist) return <p>Checklist not found</p>;

  const completed = checklist.items?.filter(i => i.result).length || 0;
  const total = checklist.items?.length || 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy capitalize">{checklist.department} QC Checklist</h1>
          <p className="text-gray-500">{checklist.customer_name} — {checklist.order_ref}</p>
        </div>
        <button onClick={handlePrint} className="btn-secondary">Print PDF</button>
      </div>

      {/* Progress bar */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Progress</span>
          <span className="text-sm font-medium text-navy">{completed}/{total} ({progress}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-accent rounded-full h-3 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="space-y-4">
        {checklist.items?.map(item => (
          <div key={item.id} className={`card border-l-4 ${item.result === 'pass' ? 'border-l-green-500' : item.result === 'fail' ? 'border-l-red-500' : 'border-l-gray-300'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-navy text-white rounded-full w-6 h-6 flex items-center justify-center">{item.sequence_no}</span>
                  <h3 className="font-semibold text-navy">{item.check_point}</h3>
                </div>
                <p className="text-sm text-gray-700 mb-1"><strong>Spec:</strong> {item.specification}</p>
                {item.verification_method && <p className="text-sm text-gray-500"><strong>Method:</strong> {item.verification_method}</p>}
                {item.manual_page_ref > 0 && <p className="text-xs text-accent mt-1">Manual Page {item.manual_page_ref}</p>}
                {item.image_path && (
                  <img src={item.image_path} alt={item.image_caption} className="mt-2 h-20 rounded border" />
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-1">
                  {['pass', 'fail', 'na'].map(r => (
                    <button
                      key={r}
                      onClick={() => updateItemMutation.mutate({ itemId: item.id, result: r, remarks: item.remarks })}
                      className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                        item.result === r
                          ? r === 'pass' ? 'bg-green-500 text-white' : r === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
