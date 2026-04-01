import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Manuals from './pages/Manuals';
import ManualDetail from './pages/ManualDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import ChecklistView from './pages/ChecklistView';
import Chat from './pages/Chat';
import NCR from './pages/NCR';
import TPQC from './pages/TPQC';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>;
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="manuals" element={<Manuals />} />
          <Route path="manuals/:id" element={<ManualDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="checklists/:id" element={<ChecklistView />} />
          <Route path="chat" element={<Chat />} />
          <Route path="ncr" element={<NCR />} />
          <Route path="tp-qc" element={<TPQC />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
