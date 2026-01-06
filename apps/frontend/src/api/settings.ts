import { api } from './client';
import type { AppSettings } from '@octopus-controller/shared';

interface SettingsResponse {
  settings: AppSettings;
}

interface RegionsResponse {
  regions: Array<{ code: string; name: string }>;
}

export async function getSettings(): Promise<AppSettings> {
  const { data } = await api.get<SettingsResponse>('/settings');
  return data.settings;
}

export async function getRegions(): Promise<Array<{ code: string; name: string }>> {
  const { data } = await api.get<RegionsResponse>('/settings/regions');
  return data.regions;
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const { data } = await api.put<SettingsResponse>('/settings', updates);
  return data.settings;
}
