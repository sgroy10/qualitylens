import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ManualDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pdf');

  const { data: manual, isLoading } = useQuery({
    queryKey: ['manual', id],
    queryFn: () => api.get(`/manuals/${id}`).then(r => r.data)
  });

  const reprocessMutation = useMutation({
    mutationFn: () => api.post(`/manuals/${id}/reprocess`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manual', id] }); toast.success('Reprocessing started'); }
  });

  if (isLoading) return <LoadingSpinner />;
  if (!manual) return <p>Manual not found</p>;

  const summary = manual.ai_summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{manual.file_name}</h1>
          <p className="text-gray-500 text-sm">{manual.customer_name} — Version {manual.version} — {manual.total_pages || '?'} pages — Status: <span className={`font-medium ${manual.status === 'ready' ? 'text-green-600' : manual.status === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>{manual.status}</span></p>
        </div>
        <button onClick={() => reprocessMutation.mutate()} className="btn-secondary text-sm" disabled={reprocessMutation.isPending}>Reprocess</button>
      </div>

      {/* AI Summary Card */}
      {summary && (
        <div className="card mb-4 border-l-4 border-l-accent">
          <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-accent rounded flex items-center justify-center text-white text-xs">AI</span>
            Manual Summary
          </h2>
          {summary.summary && <p className="text-sm text-gray-700 mb-3">{summary.summary}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {summary.approved_alloys?.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="font-semibold text-navy mb-1">Approved Alloys</div>
                <div className="text-gray-600">{summary.approved_alloys.join(', ')}</div>
              </div>
            )}
            {summary.key_tolerances?.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="font-semibold text-navy mb-1">Key Tolerances</div>
                <div className="text-gray-600">{summary.key_tolerances.join(', ')}</div>
              </div>
            )}
            {summary.product_categories?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="font-semibold text-navy mb-1">Product Categories</div>
                <div className="text-gray-600">{summary.product_categories.join(', ')}</div>
              </div>
            )}
            {summary.finding_requirements?.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="font-semibold text-navy mb-1">Finding Requirements</div>
                <div className="text-gray-600">{summary.finding_requirements.join(', ')}</div>
              </div>
            )}
            {summary.anti_tarnish_requirements?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="font-semibold text-navy mb-1">Anti-Tarnish</div>
                <div className="text-gray-600">{summary.anti_tarnish_requirements.join(', ')}</div>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-semibold text-navy mb-1">Stats</div>
              <div className="text-gray-600">{manual.total_pages} pages, {manual.images?.length || 0} images extracted</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[{ key: 'pdf', label: 'Read Manual' }, { key: 'content', label: 'Extracted Content' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pdf' && (
        <div className="card p-0 overflow-hidden">
          <iframe
            src={`/api/manuals/${id}/file`}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}
            title="QA Manual PDF"
          />
        </div>
      )}

      {tab === 'content' && (
        <div>
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
                    <p className="text-xs text-gray-400 mt-1">Page {img.page_number}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
