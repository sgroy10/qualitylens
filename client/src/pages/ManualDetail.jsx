import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ManualDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: manual, isLoading } = useQuery({ queryKey: ['manual', id], queryFn: () => api.get(`/manuals/${id}`).then(r => r.data) });

  const reprocessMutation = useMutation({
    mutationFn: () => api.post(`/manuals/${id}/reprocess`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manual', id] }); toast.success('Reprocessing started'); }
  });

  if (isLoading) return <LoadingSpinner />;
  if (!manual) return <p>Manual not found</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">{manual.file_name}</h1>
          <p className="text-gray-500">{manual.customer_name} — Version {manual.version} — {manual.total_pages} pages — Status: {manual.status}</p>
        </div>
        <button onClick={() => reprocessMutation.mutate()} className="btn-secondary" disabled={reprocessMutation.isPending}>Reprocess</button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-navy">Pages</h2>
        {manual.pages?.map(p => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-accent">Page {p.page_number}</h3>
              {p.embedding_keywords && <p className="text-xs text-gray-400 max-w-xs text-right">{p.embedding_keywords}</p>}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-auto">{p.content}</p>
          </div>
        ))}
        {manual.pages?.length === 0 && <p className="text-gray-400">No pages extracted yet.</p>}
      </div>

      {manual.images?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-navy mb-4">Extracted Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {manual.images.map(img => (
              <div key={img.id} className="card p-3">
                <img src={img.image_path} alt={img.caption} className="w-full h-32 object-contain bg-gray-50 rounded mb-2" />
                <p className="text-xs text-gray-600">{img.caption}</p>
                {img.topic_tags && <p className="text-xs text-accent mt-1">{img.topic_tags}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
