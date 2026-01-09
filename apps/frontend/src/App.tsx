import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Prices } from './pages/Prices';
import { Devices } from './pages/Devices';
import { Schedules } from './pages/Schedules';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, authEnabled } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // If auth is not enabled, allow access without login
  if (!authEnabled) {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="prices" element={<Prices />} />
          <Route path="devices" element={<Devices />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="logs" element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // If not authenticated, show login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated - show app
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="prices" element={<Prices />} />
        <Route path="devices" element={<Devices />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="logs" element={<Logs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { googleClientId } = useAuth();

  // Wrap with GoogleOAuthProvider only if we have a client ID
  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <ProtectedRoutes />
      </GoogleOAuthProvider>
    );
  }

  return <ProtectedRoutes />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
