import { api } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthConfig {
  googleClientId: string | null;
  authEnabled: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const { data } = await api.get<AuthConfig>('/auth/config');
  return data;
}

export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/google', { credential });
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
