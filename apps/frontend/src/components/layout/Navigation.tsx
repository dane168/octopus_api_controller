import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, Plug, Calendar, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/prices', icon: TrendingUp, label: 'Prices' },
  { to: '/devices', icon: Plug, label: 'Devices' },
  { to: '/schedules', icon: Calendar, label: 'Schedules' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:static md:border-t-0 md:border-r md:h-screen md:w-64 z-50">
      <div className="flex md:flex-col md:p-4">
        {/* Logo - Desktop only */}
        <div className="hidden md:block mb-8">
          <h1 className="text-xl font-bold text-gray-900">Energy Controller</h1>
          <p className="text-sm text-gray-500">Octopus Agile</p>
        </div>

        {/* Navigation items */}
        <ul className="flex w-full justify-around md:flex-col md:space-y-1">
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
      </div>
    </nav>
  );
}
