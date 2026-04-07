import { createBrowserRouter, Navigate } from 'react-router';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminInvoicesPage } from './pages/admin/AdminInvoicesPage';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { useAuth } from './context/AuthContext';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="text-[#C9A84C] text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function ProtectedAdminLayout() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: PublicLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'menu', Component: MenuPage },
      { path: 'cart', Component: CartPage },
      { path: 'track', Component: OrderTrackingPage },
      { path: 'reservations', Component: ReservationsPage },
    ],
  },
  {
    path: '/admin/login',
    Component: AdminLoginPage,
  },
  {
    path: '/admin',
    Component: ProtectedAdminLayout,
    children: [
      { index: true, Component: AdminDashboardPage },
      { path: 'products', Component: AdminProductsPage },
      { path: 'orders', Component: AdminOrdersPage },
      { path: 'invoices', Component: AdminInvoicesPage },
      { path: 'reservations', Component: AdminReservationsPage },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);