import { api } from './client';
import type { TuyaCloudDevice, TuyaSpace, TuyaDeviceDetails } from '@octopus-controller/shared';

export interface TuyaCredentialsResponse {
  configured: boolean;
  accessId?: string;
  accessSecretMasked?: string;
  endpoint?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TuyaCredentialsInput {
  accessId: string;
  accessSecret: string;
  endpoint: string;
}

export interface TuyaEndpoint {
  region: string;
  name: string;
  url: string;
}

export interface TuyaEndpointsResponse {
  endpoints: TuyaEndpoint[];
}

export interface TuyaDevicesResponse {
  devices: TuyaCloudDevice[];
}

export interface TuyaSpacesResponse {
  spaces: TuyaSpace[];
}

export interface TuyaSpaceDevicesResponse {
  devices: TuyaDeviceDetails[];
}

export interface TuyaTestResponse {
  valid: boolean;
}

export interface ImportFromCloudResponse {
  message: string;
  imported: string[];
  skipped: string[];
  total: number;
}

/**
 * Get user's saved Tuya credentials (masked)
 */
export async function getTuyaCredentials(): Promise<TuyaCredentialsResponse> {
  try {
    const { data } = await api.get<TuyaCredentialsResponse>('/tuya/credentials');
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { configured: false };
    }
    throw error;
  }
}

/**
 * Save Tuya credentials
 */
export async function saveTuyaCredentials(input: TuyaCredentialsInput): Promise<TuyaCredentialsResponse> {
  const { data } = await api.post<TuyaCredentialsResponse>('/tuya/credentials', input);
  return data;
}

/**
 * Delete Tuya credentials
 */
export async function deleteTuyaCredentials(): Promise<void> {
  await api.delete('/tuya/credentials');
}

/**
 * Test Tuya credentials without saving
 */
export async function testTuyaCredentials(input: TuyaCredentialsInput): Promise<boolean> {
  const { data } = await api.post<TuyaTestResponse>('/tuya/test', input);
  return data.valid;
}

/**
 * Get available Tuya API endpoints (regions)
 */
export async function getTuyaEndpoints(): Promise<TuyaEndpoint[]> {
  const { data } = await api.get<TuyaEndpointsResponse>('/tuya/endpoints');
  return data.endpoints;
}

/**
 * Get devices from Tuya Cloud API (legacy)
 */
export async function getTuyaCloudDevices(): Promise<TuyaCloudDevice[]> {
  const { data } = await api.get<TuyaDevicesResponse>('/tuya/devices');
  return data.devices;
}

/**
 * Get Tuya spaces (homes) for the user
 */
export async function getTuyaSpaces(): Promise<TuyaSpace[]> {
  const { data } = await api.get<TuyaSpacesResponse>('/tuya/spaces');
  return data.spaces;
}

/**
 * Get devices in a specific Tuya space with full details
 */
export async function getSpaceDevices(spaceId: string): Promise<TuyaDeviceDetails[]> {
  const { data } = await api.get<TuyaSpaceDevicesResponse>(`/tuya/spaces/${spaceId}/devices`);
  return data.devices;
}

/**
 * Import devices from a specific Tuya space into the local database
 */
export async function importDevicesFromSpace(spaceId: string): Promise<ImportFromCloudResponse> {
  const { data } = await api.post<ImportFromCloudResponse>(`/tuya/spaces/${spaceId}/import`);
  return data;
}

/**
 * Import devices from Tuya Cloud to local database (legacy)
 */
export async function importDevicesFromCloud(): Promise<ImportFromCloudResponse> {
  const { data } = await api.post<ImportFromCloudResponse>('/devices/import-from-cloud');
  return data;
}
