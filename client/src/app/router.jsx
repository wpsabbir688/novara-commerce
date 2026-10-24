import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { StoreLayout } from '../components/layout/StoreLayout.jsx';
import { AdminLayout } from '../components/layout/AdminLayout.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { ShopPage } from '../pages/ShopPage.jsx';
import { SearchPage } from '../pages/SearchPage.jsx';
import { ProductPage } from '../pages/ProductPage.jsx';
import { CartPage } from '../pages/CartPage.jsx';
import { CheckoutPage } from '../pages/CheckoutPage.jsx';
import { OrderSuccessPage } from '../pages/OrderSuccessPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { AccountLayout } from '../pages/AccountPage.jsx';
import { ProfilePage, OrderHistoryPage, OrderDetailPage, AddressesPage, WishlistPage } from '../pages/AccountPages.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage.jsx';
import { AdminProductsPage, AdminProductEditorPage } from '../pages/admin/AdminProductsPage.jsx';
import { AdminCategoriesPage, AdminBrandsPage, AdminCouponsPage, AdminSettingsPage } from '../pages/admin/AdminCatalogPages.jsx';
import { AdminInventoryPage, AdminOrdersPage, AdminOrderDetailsPage, AdminCustomersPage, AdminCustomerDetailsPage, AdminReviewsPage, AdminReportsPage, AdminStaffPage } from '../pages/admin/AdminOpsPages.jsx';

function CategoryRoute() {
  const { slug } = useParams();
  return <ShopPage categorySlug={slug} />;
}

function AdminProductEditRoute() {
  const { id } = useParams();
  return <AdminProductEditorPage productId={id} />;
}

function AdminOrderRoute() {
  const { id } = useParams();
  return <AdminOrderDetailsPage orderId={id} />;
}

function AdminCustomerRoute() {
  const { id } = useParams();
  return <AdminCustomerDetailsPage userId={id} />;
}

function AccountOrderRoute() {
  const { id } = useParams();
  return <OrderDetailPage orderId={id} />;
}

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/shop', element: <ShopPage /> },
      { path: '/category/:slug', element: <CategoryRoute /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/product/:slug', element: <ProductPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/order-success/:id', element: <OrderSuccessPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/account',
        element: <AccountLayout />,
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'orders', element: <OrderHistoryPage /> },
          { path: 'orders/:id', element: <AccountOrderRoute /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'products/new', element: <AdminProductEditorPage productId="new" /> },
      { path: 'products/:id', element: <AdminProductEditRoute /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'brands', element: <AdminBrandsPage /> },
      { path: 'inventory', element: <AdminInventoryPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'orders/:id', element: <AdminOrderRoute /> },
      { path: 'customers', element: <AdminCustomersPage /> },
      { path: 'customers/:id', element: <AdminCustomerRoute /> },
      { path: 'coupons', element: <AdminCouponsPage /> },
      { path: 'reviews', element: <AdminReviewsPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'staff', element: <AdminStaffPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);
