import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/summary').then(r => r.data)
  });

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />;

  const stats = [
    { label: 'Open Orders', value: data?.open_orders || 0, color: 'bg-blue-500', link: '/orders' },
    { label: 'Pending Checklists', value: data?.pending_checklists || 0, color: 'bg-yellow-500', link: '/orders' },
    { label: 'Open NCRs', value: data?.open_ncrs || 0, color: 'bg-red-500', link: '/ncr' },
    { label: 'Rejection Rate', value: `${data?.rejection_rate_this_month || 0}%`, color: 'bg-purple-500', link: '/tp-qc' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} to={s.link} className="card hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-white font-bold text-lg`}>
                {typeof s.value === 'string' ? s.value : s.value}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-navy mb-4">Recent Activity</h2>
        {data?.recent_activity?.length ? (
          <div className="space-y-3">
            {data.recent_activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'order' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                  {item.type === 'order' ? 'Order' : 'NCR'}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No recent activity</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <Link to="/customers" className="card text-center hover:shadow-md transition">
          <span className="text-2xl">🏢</span>
          <p className="text-sm font-medium mt-2">Customers</p>
        </Link>
        <Link to="/manuals" className="card text-center hover:shadow-md transition">
          <span className="text-2xl">📋</span>
          <p className="text-sm font-medium mt-2">QA Manuals</p>
        </Link>
        <Link to="/chat" className="card text-center hover:shadow-md transition">
          <span className="text-2xl">💬</span>
          <p className="text-sm font-medium mt-2">AI Chat</p>
        </Link>
        <Link to="/orders" className="card text-center hover:shadow-md transition">
          <span className="text-2xl">📦</span>
          <p className="text-sm font-medium mt-2">New Order</p>
        </Link>
      </div>
    </div>
  );
}
