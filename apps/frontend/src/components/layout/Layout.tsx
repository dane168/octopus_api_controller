import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Navigation />
      <main className="flex-1 pb-20 md:pb-0 md:h-screen md:overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
