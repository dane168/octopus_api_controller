import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, Plug, Calendar, History, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/prices', icon: TrendingUp, label: 'Prices' },
  { to: '/devices', icon: Plug, label: 'Devices' },
  { to: '/schedules', icon: Calendar, label: 'Schedules' },
  { to: '/logs', icon: History, label: 'Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  const { user, logout, authEnabled } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:static md:border-t-0 md:border-r md:h-screen md:w-64 z-50">
      <div className="flex md:flex-col md:p-4 md:h-full">
        {/* Logo - Desktop only */}
        <div className="hidden md:block mb-8">
          <h1 className="text-xl font-bold text-gray-900">Energy Controller</h1>
          <p className="text-sm text-gray-500">Octopus Agile</p>
        </div>

        {/* Navigation items */}
        <ul className="flex w-full justify-start md:flex-col md:space-y-1 md:flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-5 h-5 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* User section - Desktop only */}
        {authEnabled && user && (
          <div className="hidden md:block mt-auto pt-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-2 mb-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
