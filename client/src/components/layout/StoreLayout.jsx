import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { get } from '../../services/apiClient.js';
import { Header } from './Header.jsx';
import { Footer } from './Footer.jsx';
import { CartDrawer } from '../cart/CartDrawer.jsx';

export function StoreLayout() {
  const { data } = useQuery({ queryKey: ['store-settings'], queryFn: () => get('/public/store') });
  const announcement = data?.settings?.announcement;
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {announcement?.isActive && !dismissed && (
        <div className="flex items-center justify-center gap-2 bg-navy px-4 py-2 text-center text-sm text-white">
          <span>{announcement.text}</span>
          {announcement.dismissible && (
            <button onClick={() => setDismissed(true)} aria-label="Dismiss announcement" className="rounded p-0.5 hover:bg-white/20">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
