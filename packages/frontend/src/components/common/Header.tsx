import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, Bell } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { ROUTES } from '@/utils/constants';

interface HeaderProps {
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
}

export function Header({ onMenuToggle, isSidebarOpen }: HeaderProps) {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuthStore();
  const isAppRoute = location.pathname.startsWith('/app');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        {isAppRoute && (
          <button
            type="button"
            className="mr-4 lg:hidden"
            onClick={onMenuToggle}
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? (
              <X className="h-6 w-6 text-gray-500" />
            ) : (
              <Menu className="h-6 w-6 text-gray-500" />
            )}
          </button>
        )}

        {/* Logo */}
        <Link
          to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME}
          className="flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-lg font-bold text-white">Q</span>
          </div>
          <span className="hidden text-xl font-bold text-gray-900 sm:block">
            QuizGenius
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <button
                type="button"
                className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-600" />
              </button>

              {/* User menu */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    aria-label="User menu"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                      {user?.fullName?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                    <span className="hidden text-sm font-medium text-gray-700 md:block">
                      {user?.fullName || 'User'}
                    </span>
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[200px] rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                    align="end"
                    sideOffset={8}
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.fullName}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>

                    <DropdownMenu.Item asChild>
                      <Link
                        to={ROUTES.SETTINGS}
                        className={cn(
                          'flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-gray-700',
                          'hover:bg-gray-100 focus:bg-gray-100 focus:outline-none'
                        )}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />

                    <DropdownMenu.Item asChild>
                      <button
                        onClick={() => logout()}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-error-600',
                          'hover:bg-error-50 focus:bg-error-50 focus:outline-none'
                        )}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to={ROUTES.LOGIN}>
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to={ROUTES.REGISTER}>
                <Button>Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
