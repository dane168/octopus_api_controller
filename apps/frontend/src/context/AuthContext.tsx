import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import { api } from '../api/client';

interface AuthContextType {
  user: authApi.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authEnabled: boolean;
  googleClientId: string | null;
  login: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  // Set auth header when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Fetch auth config
  const { data: authConfig } = useQuery({
    queryKey: ['auth', 'config'],
    queryFn: authApi.getAuthConfig,
    staleTime: Infinity, // Config doesn't change
  });

  // Fetch current user if we have a token
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: authApi.getCurrentUser,
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authApi.loginWithGoogle,
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      queryClient.setQueryData(['auth', 'user'], data.user);
      // Invalidate all data queries to refetch with user context
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const login = async (credential: string) => {
    await loginMutation.mutateAsync(credential);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    queryClient.setQueryData(['auth', 'user'], null);
    // Clear all cached data
    queryClient.clear();
  };

  // If token exists but user fetch failed, clear the token
  useEffect(() => {
    if (token && !userLoading && !user) {
      logout();
    }
  }, [token, userLoading, user]);

  const value: AuthContextType = {
    user: user || null,
    isLoading: userLoading,
    isAuthenticated: !!user,
    authEnabled: authConfig?.authEnabled ?? false,
    googleClientId: authConfig?.googleClientId ?? null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
