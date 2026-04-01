import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Manuals() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customer');
  const [uploading, setUploading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || '');
  const [version, setVersion] = useState('1.0');

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) });
  const { data: manuals, isLoading } = useQuery({
    queryKey: ['manuals', customerId],
    queryFn: () => api.get(`/manuals${customerId ? `?customer_id=${customerId}` : ''}`).then(r => r.data)
  });

  // Auto-refresh while any manual is processing
  useEffect(() => {
    const hasProcessing = manuals?.some(m => m.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['manuals'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [manuals, queryClient]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedCustomer) { toast.error('Select customer first'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('customer_id', selectedCustomer);
    formData.append('version', version);
    try {
      await api.post('/manuals/upload', formData);
      queryClient.invalidateQueries({ queryKey: ['manuals'] });
      toast.success('Manual uploaded — processing started');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const statusBadge = (status) => {
    const colors = { processing: 'bg-yellow-100 text-yellow-700', ready: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || 'bg-gray-100'}`}>{status === 'ready' ? 'ready \u2713' : status}</span>;
  };

  if (isLoading) return <LoadingSpinner />;

  // Group manuals by customer
  const grouped = (manuals || []).reduce((acc, m) => {
    const key = m.customer_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">QA Manuals</h1>

      <div className="card mb-6">
        <h2 className="font-semibold mb-3">Upload New Manual</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
              <option value="">Select customer...</option>
              {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Version</label>
            <input className="input w-24" value={version} onChange={e => setVersion(e.target.value)} />
          </div>
          <div>
            <label className={`btn-primary cursor-pointer inline-block ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Uploading...' : 'Upload PDF'}
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      </div>

      {/* Grouped by customer */}
      {Object.keys(grouped).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([customerName, customerManuals]) => (
            <div key={customerName}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {customerName.charAt(0)}
                </div>
                <h2 className="text-lg font-semibold text-navy">{customerName}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {customerManuals.length} manual{customerManuals.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2 ml-10">
                {customerManuals.map(m => (
                  <Link key={m.id} to={`/manuals/${m.id}`} className="card block hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-navy">{m.file_name}</h3>
                        <p className="text-sm text-gray-500">
                          {m.customer_name} — v{m.version} — {m.total_pages || '?'} pages
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {m.status === 'processing' && (
                          <span className="flex items-center gap-1.5 text-xs text-yellow-600">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                            Processing... (auto-refreshing)
                          </span>
                        )}
                        {statusBadge(m.status)}
                        {m.ai_summary && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">AI Summary</span>}
                        <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">No manuals uploaded yet.</p>
      )}
    </div>
  );
}
