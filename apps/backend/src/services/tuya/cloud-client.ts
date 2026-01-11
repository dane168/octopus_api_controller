import crypto from 'crypto';
import type { Device, DeviceState, DeviceAction } from '@octopus-controller/shared';
import type { TuyaCloudDevice, TuyaDeviceStatus, TuyaSpace, TuyaSpaceResource, TuyaDeviceDetails } from '@octopus-controller/shared';
import { logger } from '../../utils/logger.js';

/**
 * Token cache for direct API calls
 */
interface TokenInfo {
  accessToken: string;
  expireTime: number;
  refreshToken: string;
  uid: string;
}
const tokenCache = new Map<string, TokenInfo>();

/**
 * Get Tuya API token (with caching)
 */
async function getTuyaToken(
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<TokenInfo> {
  const cacheKey = `${accessId}:${endpoint}`;
  const cached = tokenCache.get(cacheKey);

  // Check if we have a valid cached token (with 60 second buffer)
  if (cached && cached.expireTime > Date.now() + 60000) {
    return cached;
  }

  const t = Date.now().toString();
  const method = 'GET';
  const path = '/v1.0/token?grant_type=1';

  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const stringToSign = method + '\n' + contentHash + '\n' + '' + '\n' + path;
  const signStr = accessId + t + stringToSign;
  const sign = crypto.createHmac('sha256', accessSecret).update(signStr).digest('hex').toUpperCase();

  const response = await fetch(endpoint + path, {
    headers: {
      'client_id': accessId,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    }
  });

  const data = await response.json() as { success: boolean; result?: { access_token: string; expire_time: number; refresh_token: string; uid: string }; msg?: string };

  if (!data.success || !data.result) {
    throw new Error(`Failed to get Tuya token: ${data.msg || 'Unknown error'}`);
  }

  const tokenInfo: TokenInfo = {
    accessToken: data.result.access_token,
    expireTime: Date.now() + (data.result.expire_time * 1000),
    refreshToken: data.result.refresh_token,
    uid: data.result.uid,
  };

  tokenCache.set(cacheKey, tokenInfo);
  logger.info({ endpoint, expiresIn: data.result.expire_time, uid: tokenInfo.uid }, 'Got new Tuya API token');

  return tokenInfo;
}

/**
 * Make a direct Tuya API call
 * Returns both the response and the token info (which includes uid)
 */
async function directTuyaRequest(
  accessId: string,
  accessSecret: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  query?: Record<string, string | number | boolean>,
  body?: any
): Promise<{ success: boolean; code?: number; msg?: string; result?: any; tokenInfo?: TokenInfo }> {
  const tokenInfo = await getTuyaToken(accessId, accessSecret, endpoint);
  const t = Date.now().toString();

  // Build query string with sorted parameters
  let fullPath = path;
  if (query && Object.keys(query).length > 0) {
    const sortedKeys = Object.keys(query).sort();
    const queryString = sortedKeys.map(k => `${k}=${query[k]}`).join('&');
    fullPath = `${path}?${queryString}`;
  }

  const bodyStr = body ? JSON.stringify(body) : '';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  // The URL in stringToSign should include the query string
  const stringToSign = method + '\n' + contentHash + '\n' + '' + '\n' + fullPath;

  // For business APIs: client_id + access_token + t + stringToSign
  const signStr = accessId + tokenInfo.accessToken + t + stringToSign;
  const sign = crypto.createHmac('sha256', accessSecret).update(signStr).digest('hex').toUpperCase();

  const headers: Record<string, string> = {
    'client_id': accessId,
    'access_token': tokenInfo.accessToken,
    't': t,
    'sign': sign,
    'sign_method': 'HMAC-SHA256',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint + fullPath, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = await response.json() as { success: boolean; code?: number; msg?: string; result?: any };
  return { ...data, tokenInfo };
}

/**
 * Direct Tuya API call implementation for testing credentials
 */
async function directTuyaApiTest(
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<{ success: boolean; code?: number; msg?: string; result?: any }> {
  const t = Date.now().toString();
  const method = 'GET';
  const path = '/v1.0/token?grant_type=1';

  // Empty body SHA256
  const contentHash = crypto.createHash('sha256').update('').digest('hex');

  // Build stringToSign per Tuya docs
  const stringToSign = method + '\n' + contentHash + '\n' + '' + '\n' + path;

  // For token API: client_id + t + stringToSign
  const signStr = accessId + t + stringToSign;
  const sign = crypto.createHmac('sha256', accessSecret).update(signStr).digest('hex').toUpperCase();

  const response = await fetch(endpoint + path, {
    headers: {
      'client_id': accessId,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    }
  });

  return response.json();
}

/**
 * Get Tuya device status code based on device type
 */
function getDeviceStatusCode(deviceType: string): string {
  switch (deviceType) {
    case 'light':
      return 'switch_led';
    case 'switch':
    case 'plug':
    case 'heater':
    case 'thermostat':
    case 'hot_water':
    default:
      return 'switch_1'; // Most devices use switch_1 for primary power
  }
}

/**
 * Get list of spaces (homes) from Tuya Cloud API
 * Uses /v2.0/cloud/space/child endpoint
 */
export async function getTuyaSpaces(
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<TuyaSpace[]> {
  try {
    const response = await directTuyaRequest(
      accessId,
      accessSecret,
      endpoint,
      'GET',
      '/v2.0/cloud/space/child',
      { only_sub: false }
    );

    logger.info({
      success: response.success,
      code: response.code,
      msg: response.msg,
      hasResult: !!response.result
    }, 'Fetched Tuya spaces');

    if (response.success && response.result?.data) {
      // The API returns an array of space IDs (numbers)
      const spaceIds: number[] = response.result.data;
      const spaces: TuyaSpace[] = spaceIds.map(id => ({
        id: id.toString(),
        name: `Space ${id}` // Default name, can be fetched separately if needed
      }));

      logger.info({ spaceCount: spaces.length }, 'Parsed Tuya spaces');
      return spaces;
    }

    throw new Error(`Failed to fetch spaces: ${response.msg || 'Unknown error'}`);
  } catch (error) {
    logger.error({ error }, 'Error fetching Tuya spaces');
    throw error;
  }
}

/**
 * Get resources (devices) in a specific space
 * Uses /v2.0/cloud/space/{space_id}/resource endpoint
 */
export async function getSpaceResources(
  accessId: string,
  accessSecret: string,
  endpoint: string,
  spaceId: string
): Promise<TuyaSpaceResource[]> {
  try {
    const response = await directTuyaRequest(
      accessId,
      accessSecret,
      endpoint,
      'GET',
      `/v2.0/cloud/space/${spaceId}/resource`,
      { only_sub: false }
    );

    logger.info({
      spaceId,
      success: response.success,
      code: response.code,
      msg: response.msg,
      hasResult: !!response.result
    }, 'Fetched space resources');

    if (response.success && response.result?.data) {
      const resources: TuyaSpaceResource[] = response.result.data;
      logger.info({ spaceId, resourceCount: resources.length }, 'Parsed space resources');
      return resources;
    }

    throw new Error(`Failed to fetch space resources: ${response.msg || 'Unknown error'}`);
  } catch (error) {
    logger.error({ error, spaceId }, 'Error fetching space resources');
    throw error;
  }
}

/**
 * Get detailed device information
 * Uses /v2.0/cloud/thing/{device_id} endpoint
 */
export async function getDeviceDetails(
  accessId: string,
  accessSecret: string,
  endpoint: string,
  deviceId: string
): Promise<TuyaDeviceDetails> {
  try {
    const response = await directTuyaRequest(
      accessId,
      accessSecret,
      endpoint,
      'GET',
      `/v2.0/cloud/thing/${deviceId}`
    );

    logger.info({
      deviceId,
      success: response.success,
      code: response.code,
      msg: response.msg,
      hasResult: !!response.result
    }, 'Fetched device details');

    if (response.success && response.result) {
      const details: TuyaDeviceDetails = response.result;
      logger.info({ deviceId, name: details.custom_name || details.name, category: details.category }, 'Parsed device details');
      return details;
    }

    throw new Error(`Failed to fetch device details: ${response.msg || 'Unknown error'}`);
  } catch (error) {
    logger.error({ error, deviceId }, 'Error fetching device details');
    throw error;
  }
}

/**
 * Get all devices from a space with full details
 */
export async function getDevicesFromSpace(
  accessId: string,
  accessSecret: string,
  endpoint: string,
  spaceId: string
): Promise<TuyaDeviceDetails[]> {
  try {
    // First get all resources in the space
    const resources = await getSpaceResources(accessId, accessSecret, endpoint, spaceId);

    // Filter to only device resources (res_type === 0)
    const deviceResources = resources.filter(r => r.res_type === 0);

    logger.info({ spaceId, deviceCount: deviceResources.length }, 'Found devices in space');

    // Fetch details for each device
    const devices: TuyaDeviceDetails[] = [];
    for (const resource of deviceResources) {
      try {
        const details = await getDeviceDetails(accessId, accessSecret, endpoint, resource.res_id);
        devices.push(details);
      } catch (error) {
        logger.warn({ deviceId: resource.res_id, error }, 'Failed to fetch device details, skipping');
      }
    }

    logger.info({ spaceId, fetchedCount: devices.length }, 'Fetched all device details from space');
    return devices;
  } catch (error) {
    logger.error({ error, spaceId }, 'Error fetching devices from space');
    throw error;
  }
}

/**
 * Get list of devices from Tuya Cloud API (legacy method)
 * Tries multiple endpoints until one works
 */
export async function getTuyaDevices(
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<TuyaCloudDevice[]> {
  try {
    // Get the token which includes the UID of the linked user
    const tokenInfo = await getTuyaToken(accessId, accessSecret, endpoint);
    logger.info({ uid: tokenInfo.uid }, 'Got token with UID, fetching devices');

    // Try multiple API endpoints in order of preference
    const endpoints = [
      // Smart Home endpoint - requires Smart Home Device Management API
      { path: `/v1.0/users/${tokenInfo.uid}/devices`, name: 'Smart Home devices' },
      // IoT Core endpoint - requires IoT Core API
      { path: '/v1.0/devices', query: { page_no: 1, page_size: 100 }, name: 'IoT Core devices' },
      // Alternative IoT Core endpoint
      { path: '/v1.2/iot-03/devices', query: { page_no: 1, page_size: 100 }, name: 'IoT Core v1.2 devices' },
      // Industry project endpoint
      { path: '/v1.1/iot-03/devices', query: { page_no: 1, page_size: 100 }, name: 'IoT Core v1.1 devices' },
    ];

    for (const ep of endpoints) {
      const response = await directTuyaRequest(
        accessId,
        accessSecret,
        endpoint,
        'GET',
        ep.path,
        ep.query
      );

      logger.info({
        endpoint: ep.name,
        path: ep.path,
        success: response.success,
        code: response.code,
        msg: response.msg,
        hasResult: !!response.result
      }, 'Tried device endpoint');

      if (response.success && response.result) {
        // Handle different response formats
        let devices: TuyaCloudDevice[];
        if (Array.isArray(response.result)) {
          devices = response.result;
        } else if (response.result.list) {
          devices = response.result.list;
        } else if (response.result.devices) {
          devices = response.result.devices;
        } else {
          devices = [];
        }

        logger.info({ deviceCount: devices.length, endpoint: ep.name }, 'Fetched devices from Tuya Cloud');
        return devices;
      }
    }

    // All endpoints failed
    throw new Error('Failed to fetch devices. Please ensure:\n1. Your Tuya app account is linked to your Cloud project (Devices > Link Tuya App Account)\n2. You have subscribed to the required APIs (Smart Home Device Management or IoT Core)');
  } catch (error) {
    logger.error({ error }, 'Error fetching devices from Tuya Cloud');
    throw error;
  }
}

/**
 * Get device state from Tuya Cloud API
 */
export async function getDeviceState(
  device: Device,
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<DeviceState> {
  try {
    const deviceId = device.config.deviceId;

    if (!deviceId) {
      throw new Error('Device ID is required for cloud protocol');
    }

    const response = await directTuyaRequest(
      accessId,
      accessSecret,
      endpoint,
      'GET',
      `/v2.0/cloud/thing/${deviceId}/shadow/properties`
    );

    if (response.success && response.result) {
      const result = response.result as { properties?: TuyaDeviceStatus[] };
      const properties = result.properties || [];
      const statusCode = getDeviceStatusCode(device.type);
      const powerStatus = properties.find((p) => p.code === statusCode || p.code === 'switch_1' || p.code === 'switch');

      logger.debug({ deviceId, properties, statusCode }, 'Fetched device state from Tuya Cloud');

      return {
        power: powerStatus ? Boolean(powerStatus.value) : false,
        raw: properties,
      };
    }

    logger.error({ response }, 'Failed to fetch device state from Tuya Cloud');
    throw new Error(`Failed to fetch device state: ${response.msg || 'Unknown error'}`);
  } catch (error) {
    logger.error({ error, deviceId: device.id }, 'Error fetching device state from Tuya Cloud');
    throw error;
  }
}

/**
 * Control device via Tuya Cloud API
 */
export async function controlDevice(
  device: Device,
  action: DeviceAction,
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<DeviceState> {
  try {
    const deviceId = device.config.deviceId;

    if (!deviceId) {
      throw new Error('Device ID is required for cloud protocol');
    }

    // Get current state if action is 'toggle'
    let targetState: boolean;
    if (action === 'toggle') {
      const currentState = await getDeviceState(device, accessId, accessSecret, endpoint);
      targetState = !currentState.power;
    } else {
      targetState = action === 'on';
    }

    const statusCode = getDeviceStatusCode(device.type);

    const response = await directTuyaRequest(
      accessId,
      accessSecret,
      endpoint,
      'POST',
      `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,
      undefined,
      {
        properties: {
          [statusCode]: targetState,
        },
      }
    );

    if (response.success) {
      logger.info({ deviceId, action, targetState }, 'Controlled device via Tuya Cloud');

      // Return the new state
      return {
        power: targetState,
      };
    }

    logger.error({ response }, 'Failed to control device via Tuya Cloud');
    throw new Error(`Failed to control device: ${response.msg || 'Unknown error'}`);
  } catch (error) {
    logger.error({ error, deviceId: device.id, action }, 'Error controlling device via Tuya Cloud');
    throw error;
  }
}

/**
 * Test Tuya Cloud API connection
 */
export async function testConnection(
  accessId: string,
  accessSecret: string,
  endpoint: string
): Promise<boolean> {
  try {
    // Trim whitespace from credentials (common copy/paste issue)
    const cleanAccessId = accessId.trim();
    const cleanAccessSecret = accessSecret.trim();

    logger.info({
      accessIdLength: cleanAccessId.length,
      accessSecretLength: cleanAccessSecret.length,
      endpoint
    }, 'Testing Tuya credentials with direct API call');

    // Use direct API call to test credentials (bypasses library issues)
    const directResponse = await directTuyaApiTest(cleanAccessId, cleanAccessSecret, endpoint);

    logger.info(
      {
        success: directResponse.success,
        code: directResponse.code,
        msg: directResponse.msg,
        hasResult: !!directResponse.result,
        endpoint
      },
      'Direct Tuya API test result'
    );

    // If direct API call succeeds, credentials are valid
    if (directResponse.success) {
      logger.info({ endpoint }, 'Tuya credentials validated successfully');
      return true;
    }

    // Log the error
    logger.error(
      {
        code: directResponse.code,
        msg: directResponse.msg,
        endpoint,
        accessIdPrefix: cleanAccessId.substring(0, 6) + '...'
      },
      'Tuya API returned error'
    );

    return false;
  } catch (error: any) {
    logger.error(
      {
        errorMessage: error?.message,
        errorName: error?.name,
        errorStack: error?.stack,
        errorCode: error?.code,
        error: JSON.stringify(error, Object.getOwnPropertyNames(error || {}))
      },
      'Error testing Tuya Cloud API connection'
    );
    return false;
  }
}

/**
 * Clear token cache for a user
 */
export function clearClientCache(accessId: string, endpoint: string): void {
  const cacheKey = `${accessId}:${endpoint}`;
  tokenCache.delete(cacheKey);
  logger.debug({ cacheKey }, 'Cleared Tuya token cache');
}

/**
 * Clear all cached tokens
 */
export function clearAllClientCaches(): void {
  tokenCache.clear();
  logger.info('Cleared all Tuya token caches');
}
