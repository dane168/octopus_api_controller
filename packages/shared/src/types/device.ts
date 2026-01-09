/**
 * Supported device types
 */
export type DeviceType = 'switch' | 'plug' | 'light' | 'heater' | 'thermostat' | 'hot_water';

/**
 * Supported device protocols/adapters
 */
export type DeviceProtocol = 'tuya-local' | 'mock';

/**
 * Device connection status
 */
export type DeviceStatus = 'online' | 'offline' | 'unknown';

/**
 * Device configuration (protocol-specific)
 */
export interface DeviceConfig {
  // Tuya-specific configuration
  deviceId?: string;
  localKey?: string;
  ip?: string;
  version?: '3.1' | '3.3' | '3.4';
}

/**
 * Device entity stored in database
 */
export interface Device {
  id: string;
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
  protocol: DeviceProtocol;
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
