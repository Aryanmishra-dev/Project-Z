import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header, Sidebar } from '@/components/common';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        isSidebarOpen={sidebarOpen}
      />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main id="main-content" className="flex-1 p-4 lg:p-8" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
