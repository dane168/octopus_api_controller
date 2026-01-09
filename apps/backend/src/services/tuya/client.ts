import TuyAPI from 'tuyapi';
import { logger } from '../../utils/logger.js';
import type { Device, DeviceConfig, DeviceState, DeviceAction, DeviceType } from '@octopus-controller/shared';

// Cache of active device connections
const deviceConnections = new Map<string, TuyAPI>();

/**
 * Get the DPS index for power control based on device type
 * - Switches/plugs typically use DPS 1
 * - Lights (bulbs, LED strips) typically use DPS 20 (switch_led)
 */
function getPowerDps(deviceType: DeviceType): string {
  switch (deviceType) {
    case 'light':
      return '20'; // switch_led for Tuya lights
    case 'switch':
    case 'plug':
    case 'heater':
    case 'thermostat':
    case 'hot_water':
    default:
      return '1'; // Standard power DPS for switches/plugs
  }
}

interface TuyaDeviceOptions {
  id: string;
  key: string;
  ip?: string;
  version?: '3.1' | '3.3' | '3.4';
}

/**
 * Create a TuyAPI instance for a device
 */
function createTuyaDevice(config: DeviceConfig): TuyAPI {
  const options: TuyaDeviceOptions = {
    id: config.deviceId!,
    key: config.localKey!,
  };

  if (config.ip) {
    options.ip = config.ip;
  }

  if (config.version) {
    options.version = config.version;
  }

  return new TuyAPI(options);
}

/**
 * Get or create a connection to a Tuya device
 */
async function getDeviceConnection(device: Device): Promise<TuyAPI> {
  // Check for existing connection
  const existing = deviceConnections.get(device.id);
  if (existing) {
    return existing;
  }

  // Create new connection
  const tuyaDevice = createTuyaDevice(device.config);

  // Set up event listeners
  tuyaDevice.on('connected', () => {
    logger.info({ deviceId: device.id, name: device.name }, 'Tuya device connected');
  });

  tuyaDevice.on('disconnected', () => {
    logger.info({ deviceId: device.id, name: device.name }, 'Tuya device disconnected');
    deviceConnections.delete(device.id);
  });

  tuyaDevice.on('error', (error) => {
    logger.error({ deviceId: device.id, name: device.name, error: error.message }, 'Tuya device error');
    deviceConnections.delete(device.id);
  });

  // Store connection
  deviceConnections.set(device.id, tuyaDevice);

  return tuyaDevice;
}

/**
 * Connect to a Tuya device and get its status
 */
export async function getDeviceState(device: Device): Promise<DeviceState> {
  if (device.protocol !== 'tuya-local') {
    throw new Error(`Unsupported protocol: ${device.protocol}`);
  }

  const tuyaDevice = await getDeviceConnection(device);
  const powerDps = getPowerDps(device.type);

  try {
    // Find device on network if IP not specified
    if (!device.config.ip) {
      await tuyaDevice.find();
    }

    // Connect and get status
    await tuyaDevice.connect();

    // Get the specific DPS for power state
    const status = await tuyaDevice.get({ dps: powerDps });

    // Convert to boolean power state
    const power = typeof status === 'boolean' ? status : Boolean(status);

    // Also get all DPS for raw data
    const allStatus = await tuyaDevice.get({ schema: true });

    logger.info({ deviceId: device.id, deviceType: device.type, powerDps, status, power }, 'Got device state');

    return {
      power,
      raw: allStatus,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ deviceId: device.id, errorMessage }, 'Failed to get device state');
    throw new Error(`Failed to get device state: ${errorMessage}`);
  } finally {
    // Disconnect after getting status to free up connection
    try {
      await tuyaDevice.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    deviceConnections.delete(device.id);
  }
}

/**
 * Control a Tuya device (on/off/toggle)
 */
export async function controlDevice(device: Device, action: DeviceAction): Promise<DeviceState> {
  if (device.protocol !== 'tuya-local') {
    throw new Error(`Unsupported protocol: ${device.protocol}`);
  }

  const tuyaDevice = await getDeviceConnection(device);
  const powerDps = getPowerDps(device.type);

  try {
    // Find device on network if IP not specified
    if (!device.config.ip) {
      await tuyaDevice.find();
    }

    // Connect
    await tuyaDevice.connect();

    let newState: boolean;

    if (action === 'toggle') {
      // Get current state and toggle using the correct DPS
      const currentStatus = await tuyaDevice.get({ dps: powerDps });
      const currentPower = typeof currentStatus === 'boolean' ? currentStatus : Boolean(currentStatus);
      newState = !currentPower;
    } else {
      newState = action === 'on';
    }

    // Set the new state using the correct DPS for the device type
    await tuyaDevice.set({ dps: powerDps, set: newState });

    logger.info({ deviceId: device.id, name: device.name, deviceType: device.type, powerDps, action, newState }, 'Device controlled');

    return {
      power: newState,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ deviceId: device.id, action, errorMessage }, 'Failed to control device');
    throw new Error(`Device control failed: ${errorMessage}`);
  } finally {
    // Disconnect after control to free up connection
    try {
      await tuyaDevice.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    deviceConnections.delete(device.id);
  }
}

/**
 * Test connection to a Tuya device
 */
export async function testDeviceConnection(config: DeviceConfig): Promise<boolean> {
  const tuyaDevice = createTuyaDevice(config);

  try {
    // Find device on network if IP not specified
    if (!config.ip) {
      await tuyaDevice.find({ timeout: 10 });
    }

    // Try to connect
    await tuyaDevice.connect();

    // Get status to verify connection works
    await tuyaDevice.get();

    logger.info({ deviceId: config.deviceId }, 'Device connection test successful');
    return true;
  } catch (error) {
    logger.error({ deviceId: config.deviceId, error }, 'Device connection test failed');
    return false;
  } finally {
    try {
      await tuyaDevice.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}

/**
 * Disconnect all cached device connections
 */
export async function disconnectAllDevices(): Promise<void> {
  for (const [id, device] of deviceConnections) {
    try {
      await device.disconnect();
      logger.info({ deviceId: id }, 'Disconnected device');
    } catch {
      // Ignore errors
    }
  }
  deviceConnections.clear();
}
