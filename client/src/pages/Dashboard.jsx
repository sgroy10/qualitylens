import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/summary').then(r => r.data),
    refetchInterval: 30000
  });

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />;

  const stats = [
    { label: 'Open Orders', value: data?.open_orders || 0, icon: '📦', color: 'border-blue-500 bg-blue-50', numColor: 'text-blue-700', link: '/orders', hint: 'Orders in production' },
    { label: 'Pending Checklists', value: data?.pending_checklists || 0, icon: '📋', color: 'border-yellow-500 bg-yellow-50', numColor: 'text-yellow-700', link: '/orders', hint: 'Checklists not yet finalised' },
    { label: 'Open NCRs', value: data?.open_ncrs || 0, icon: '⚠️', color: 'border-red-500 bg-red-50', numColor: 'text-red-700', link: '/ncr', hint: 'Non-conformances to close' },
    { label: 'QA Manuals Ready', value: data?.ready_manuals || 0, icon: '📚', color: 'border-green-500 bg-green-50', numColor: 'text-green-700', link: '/manuals', hint: 'Processed and searchable' },
  ];

  const statusColors = {
    open: 'bg-blue-100 text-blue-700',
    in_production: 'bg-yellow-100 text-yellow-700',
    dispatched: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sky Gold & Diamonds Ltd — QualityLens</p>
        </div>
        <Link to="/orders" className="btn-primary text-sm">+ New Order</Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} to={s.link} className={`block rounded-xl border-l-4 p-4 hover:shadow-md transition ${s.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-3xl font-bold ${s.numColor}`}>{s.value}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.hint}</p>
              </div>
              <span className="text-2xl">{s.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Rejection Rate Banner */}
      {data?.rejection_rate_this_month > 0 && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${data.rejection_rate_this_month > 20 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div>
            <p className="text-sm font-semibold text-gray-700">This month's rejection rate</p>
            <p className="text-xs text-gray-500">Based on Third Party QC results (last 30 days)</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${data.rejection_rate_this_month > 20 ? 'text-red-600' : 'text-yellow-600'}`}>{data.rejection_rate_this_month}%</p>
            <Link to="/tp-qc" className="text-xs text-accent hover:underline">View details</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Recent Orders</h2>
            <Link to="/orders" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recent_orders?.length ? (
              data.recent_orders.map(o => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-medium text-navy">{o.order_ref}</p>
                    <p className="text-xs text-gray-400">{o.customer_name} — {o.style_count} styles</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.status] || 'bg-gray-100'}`}>{o.status}</span>
                    <p className="text-xs text-gray-300 mt-1">{new Date(o.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No orders yet. <Link to="/orders" className="text-accent hover:underline">Create one</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent NCRs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Open NCRs</h2>
            <Link to="/ncr" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recent_ncrs?.length ? (
              data.recent_ncrs.map(n => (
                <div key={n.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-navy">{n.ncr_ref}</p>
                    <p className="text-xs text-gray-400">{n.customer_name} — {n.rejection_category}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${n.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{n.status}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No open NCRs.</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/manuals', icon: '📋', label: 'Upload Manual' },
            { to: '/chat', icon: '💬', label: 'Ask AI' },
            { to: '/ncr', icon: '⚠️', label: 'Log NCR' },
            { to: '/tp-qc', icon: '✅', label: 'TP QC Results' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-accent hover:shadow-sm transition text-sm font-medium text-gray-700">
              <span className="text-xl">{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
