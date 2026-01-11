/**
 * Tuya Cloud API credentials stored per user
 */
export interface TuyaCredentials {
  id: string;
  userId: string;
  accessId: string;
  accessSecret: string; // Stored encrypted
  endpoint: string; // Regional endpoint URL
  uid?: string; // Optional Tuya user ID
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Input for creating/updating Tuya credentials
 */
export interface TuyaCredentialsInput {
  accessId: string;
  accessSecret: string;
  endpoint?: string; // Defaults to EU endpoint
}

/**
 * Tuya Cloud API regional endpoint mapping
 */
export const TUYA_ENDPOINTS = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
  sg: 'https://openapi.tuyasg.com',
} as const;

/**
 * Tuya device from Cloud API
 */
export interface TuyaCloudDevice {
  id: string;
  name: string;
  uid: string;
  local_key: string;
  category: string;
  product_id: string;
  product_name: string;
  sub: boolean;
  uuid: string;
  online: boolean;
  status: Array<{
    code: string;
    value: unknown;
  }>;
}

/**
 * Tuya device status item
 */
export interface TuyaDeviceStatus {
  code: string;
  value: unknown;
}

/**
 * Tuya device command
 */
export interface TuyaDeviceCommand {
  code: string;
  value: unknown;
}

/**
 * Tuya Space (home/location) from Cloud API
 */
export interface TuyaSpace {
  id: string;
  name?: string;
}

/**
 * Tuya Space Resource (device reference in a space)
 */
export interface TuyaSpaceResource {
  res_id: string;
  res_type: number; // 0 = device
}

/**
 * Detailed Tuya device info from /v2.0/cloud/thing/{device_id}
 */
export interface TuyaDeviceDetails {
  id: string;
  uuid: string;
  name: string;
  custom_name?: string;
  category: string;
  product_id: string;
  product_name: string;
  model?: string;
  icon?: string;
  is_online: boolean;
  ip?: string;
  local_key: string;
  lat?: string;
  lon?: string;
  time_zone?: string;
  sub: boolean;
  bind_space_id?: string;
  active_time?: number;
  create_time?: number;
  update_time?: number;
}
