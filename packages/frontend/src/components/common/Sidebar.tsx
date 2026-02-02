import { LayoutDashboard, FileText, BarChart3, Settings, HelpCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/utils/cn';
import { ROUTES } from '@/utils/constants';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    label: 'My PDFs',
    href: ROUTES.PDFS,
    icon: FileText,
  },
  {
    label: 'Analytics',
    href: ROUTES.ANALYTICS,
    icon: BarChart3,
  },
  {
    label: 'Settings',
    href: ROUTES.SETTINGS,
    icon: Settings,
  },
];

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200',
          'transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Skip link target */}
        <div className="h-16 border-b border-gray-200" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <a
            href="#help"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <HelpCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            Help & Support
          </a>
        </div>
      </aside>
    </>
  );
}
