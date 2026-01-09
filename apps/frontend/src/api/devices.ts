import { api } from './client';
import type {
  Device,
  DeviceState,
  CreateDeviceInput,
  UpdateDeviceInput,
  DeviceAction,
  DeviceConfig,
} from '@octopus-controller/shared';

interface DevicesResponse {
  devices: Device[];
}

interface DeviceResponse {
  device: Device;
}

interface DeviceStateResponse {
  device: Device;
  state: DeviceState;
}

interface TestConnectionResponse {
  success: boolean;
}

export async function getDevices(): Promise<Device[]> {
  const { data } = await api.get<DevicesResponse>('/devices');
  return data.devices;
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await api.get<DeviceResponse>(`/devices/${id}`);
  return data.device;
}

export async function createDevice(input: CreateDeviceInput): Promise<Device> {
  const { data } = await api.post<DeviceResponse>('/devices', input);
  return data.device;
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<Device> {
  const { data } = await api.put<DeviceResponse>(`/devices/${id}`, input);
  return data.device;
}

export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
}

export async function controlDevice(id: string, action: DeviceAction): Promise<DeviceStateResponse> {
  const { data } = await api.post<DeviceStateResponse>(`/devices/${id}/control`, { action });
  return data;
}

export async function getDeviceState(id: string): Promise<DeviceStateResponse> {
  const { data } = await api.get<DeviceStateResponse>(`/devices/${id}/state`);
  return data;
}

export async function testConnection(config: DeviceConfig): Promise<boolean> {
  const { data } = await api.post<TestConnectionResponse>('/devices/test-connection', config);
  return data.success;
}

interface TuyaDevice {
  id: string;
  custom_name?: string;
  name: string;
  local_key: string;
  ip?: string;
  category: string;
  is_online?: boolean;
}

interface ImportResponse {
  message: string;
  imported: string[];
  skipped: string[];
}

export async function importDevices(devices: TuyaDevice[]): Promise<ImportResponse> {
  const { data } = await api.post<ImportResponse>('/devices/import', { devices });
  return data;
}
