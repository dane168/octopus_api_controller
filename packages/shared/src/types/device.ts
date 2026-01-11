/**
 * Supported device types
 */
export type DeviceType = 'switch' | 'plug' | 'light' | 'heater' | 'thermostat' | 'hot_water';

/**
 * Supported device protocols/adapters (Tuya Cloud only)
 */
export type DeviceProtocol = 'tuya-cloud' | 'mock';

/**
 * Tuya Cloud API regional endpoints
 */
export type TuyaRegion = 'eu' | 'us' | 'cn' | 'in' | 'sg';

/**
 * Device connection status
 */
export type DeviceStatus = 'online' | 'offline' | 'unknown';

/**
 * Device configuration for Tuya Cloud
 */
export interface DeviceConfig {
  deviceId: string; // Tuya device ID (required)
  localKey?: string; // Tuya local key (for future local control)
  category?: string; // Tuya device category (e.g., 'cz' for plug)
  productId?: string; // Tuya product ID
  icon?: string; // Device icon URL
}

/**
 * Device entity stored in database
 */
export interface Device {
  id: string;
  userId: string; // User who owns the device
  name: string;
  type: DeviceType;
  protocol: DeviceProtocol;
  config: DeviceConfig;
  status: DeviceStatus;
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Device state (current power status and protocol-specific data)
 */
export interface DeviceState {
  power: boolean;
  [key: string]: unknown;
}

/**
 * Device with current state
 */
export interface DeviceWithState extends Device {
  state: DeviceState;
}

/**
 * Input for creating a new device
 */
export interface CreateDeviceInput {
  name: string;
  type: DeviceType;
  config: DeviceConfig;
}

/**
 * Input for updating a device
 */
export interface UpdateDeviceInput {
  name?: string;
  type?: DeviceType;
  config?: Partial<DeviceConfig>;
}

/**
 * Device control action
 */
export type DeviceAction = 'on' | 'off' | 'toggle';

/**
 * Input for controlling a device
 */
export interface DeviceControlInput {
  action: DeviceAction;
}
