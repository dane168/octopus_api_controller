import type { Device, DeviceState, DeviceAction } from '@octopus-controller/shared';
import * as cloudClient from './cloud-client.js';
import * as tuyaCredsRepo from '../../repositories/tuya-credentials.js';

// Re-export cloud client functions
export * from './cloud-client.js';

/**
 * Get device state via Tuya Cloud API
 */
export async function getDeviceState(device: Device): Promise<DeviceState> {
  const userId = device.userId;
  if (!userId) {
    throw new Error('User ID is required for devices');
  }

  const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
  if (!credentials) {
    throw new Error('Tuya Cloud credentials not configured. Please add your Tuya API credentials in Settings.');
  }

  return cloudClient.getDeviceState(
    device,
    credentials.accessId,
    credentials.accessSecret,
    credentials.endpoint
  );
}

/**
 * Control device via Tuya Cloud API
 */
export async function controlDevice(device: Device, action: DeviceAction): Promise<DeviceState> {
  const userId = device.userId;
  if (!userId) {
    throw new Error('User ID is required for devices');
  }

  const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
  if (!credentials) {
    throw new Error('Tuya Cloud credentials not configured. Please add your Tuya API credentials in Settings.');
  }

  return cloudClient.controlDevice(
    device,
    action,
    credentials.accessId,
    credentials.accessSecret,
    credentials.endpoint
  );
}
