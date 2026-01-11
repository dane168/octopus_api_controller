import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as tuyaCredsRepo from '../repositories/tuya-credentials.js';
import * as tuyaCloudClient from '../services/tuya/cloud-client.js';
import * as devicesRepo from '../repositories/devices.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';
import type { DeviceType } from '@octopus-controller/shared';

const router = Router();

// Apply auth middleware to all routes
router.use(optionalAuth);

// Validation schemas
const tuyaCredentialsSchema = z.object({
  accessId: z.string().min(1, 'Access ID is required'),
  accessSecret: z.string().min(1, 'Access Secret is required'),
  endpoint: z.string().url().optional(),
});

/**
 * GET /api/tuya/credentials
 * Get user's Tuya Cloud API credentials (access secret is masked)
 */
router.get('/credentials', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);

    if (!credentials) {
      return res.status(404).json({ error: 'Tuya credentials not configured', configured: false });
    }

    // Mask the access secret for security
    res.json({
      configured: true,
      accessId: credentials.accessId,
      accessSecretMasked: '***' + credentials.accessSecret.slice(-4),
      endpoint: credentials.endpoint,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt,
    });
  } catch (error) {
    logger.error({ error }, 'Error getting Tuya credentials');
    res.status(500).json({ error: 'Failed to get Tuya credentials' });
  }
});

/**
 * POST /api/tuya/credentials
 * Create or update user's Tuya Cloud API credentials
 */
router.post('/credentials', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = tuyaCredentialsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const input = validation.data;
    const endpoint = input.endpoint || 'https://openapi.tuyaeu.com';

    // Log credentials info for debugging (not the actual secret!)
    logger.info({
      accessIdLength: input.accessId.length,
      accessIdPrefix: input.accessId.substring(0, 6),
      accessSecretLength: input.accessSecret.length,
      endpoint
    }, 'Testing Tuya credentials from request');

    // Test the credentials before saving
    const isValid = await tuyaCloudClient.testConnection(
      input.accessId,
      input.accessSecret,
      endpoint
    );

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid Tuya credentials - connection test failed. Please check your Access ID, Access Secret, and ensure you selected the correct region endpoint.'
      });
    }

    const credentials = await tuyaCredsRepo.upsertTuyaCredentials(userId, {
      ...input,
      endpoint,
    });

    // Clear the client cache so new credentials are used
    tuyaCloudClient.clearClientCache(credentials.accessId, credentials.endpoint);

    res.json({
      success: true,
      configured: true,
      accessId: credentials.accessId,
      accessSecretMasked: '***' + credentials.accessSecret.slice(-4),
      endpoint: credentials.endpoint,
    });
  } catch (error) {
    logger.error({ error }, 'Error saving Tuya credentials');
    res.status(500).json({ error: 'Failed to save Tuya credentials' });
  }
});

/**
 * DELETE /api/tuya/credentials
 * Delete user's Tuya Cloud API credentials
 */
router.delete('/credentials', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get credentials to clear cache
    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (credentials) {
      tuyaCloudClient.clearClientCache(credentials.accessId, credentials.endpoint);
    }

    await tuyaCredsRepo.deleteTuyaCredentials(userId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error deleting Tuya credentials');
    res.status(500).json({ error: 'Failed to delete Tuya credentials' });
  }
});

/**
 * GET /api/tuya/devices
 * Get list of devices from Tuya Cloud API
 */
router.get('/devices', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Tuya credentials not configured. Please add your Tuya API credentials in Settings first.' });
    }

    const devices = await tuyaCloudClient.getTuyaDevices(
      credentials.accessId,
      credentials.accessSecret,
      credentials.endpoint
    );

    res.json({ devices });
  } catch (error) {
    logger.error({ error }, 'Error fetching Tuya devices');
    res.status(500).json({ error: 'Failed to fetch Tuya devices' });
  }
});

/**
 * POST /api/tuya/test
 * Test Tuya Cloud API credentials (without saving)
 */
router.post('/test', async (req, res) => {
  try {
    const validation = tuyaCredentialsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { accessId, accessSecret, endpoint } = validation.data;

    const isValid = await tuyaCloudClient.testConnection(
      accessId,
      accessSecret,
      endpoint || 'https://openapi.tuyaeu.com'
    );

    res.json({ valid: isValid });
  } catch (error) {
    logger.error({ error }, 'Error testing Tuya credentials');
    res.status(500).json({ error: 'Failed to test Tuya credentials', valid: false });
  }
});

/**
 * GET /api/tuya/endpoints
 * Get list of available Tuya API endpoints
 */
router.get('/endpoints', (_req, res) => {
  res.json({
    endpoints: [
      { region: 'eu-central', name: 'Central Europe', url: 'https://openapi.tuyaeu.com' },
      { region: 'eu-west', name: 'Western Europe', url: 'https://openapi-weaz.tuyaeu.com' },
      { region: 'us-west', name: 'Western America', url: 'https://openapi.tuyaus.com' },
      { region: 'us-east', name: 'Eastern America', url: 'https://openapi-ueaz.tuyaus.com' },
      { region: 'cn', name: 'China', url: 'https://openapi.tuyacn.com' },
      { region: 'in', name: 'India', url: 'https://openapi.tuyain.com' },
    ],
  });
});

/**
 * GET /api/tuya/spaces
 * Get list of Tuya spaces (homes) for the user
 */
router.get('/spaces', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Tuya credentials not configured' });
    }

    const spaces = await tuyaCloudClient.getTuyaSpaces(
      credentials.accessId,
      credentials.accessSecret,
      credentials.endpoint
    );

    res.json({ spaces });
  } catch (error) {
    logger.error({ error }, 'Error fetching Tuya spaces');
    res.status(500).json({ error: 'Failed to fetch Tuya spaces' });
  }
});

/**
 * GET /api/tuya/spaces/:spaceId/devices
 * Get list of devices in a specific Tuya space with full details
 */
router.get('/spaces/:spaceId/devices', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { spaceId } = req.params;
    if (!spaceId) {
      return res.status(400).json({ error: 'Space ID is required' });
    }

    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Tuya credentials not configured' });
    }

    const devices = await tuyaCloudClient.getDevicesFromSpace(
      credentials.accessId,
      credentials.accessSecret,
      credentials.endpoint,
      spaceId
    );

    res.json({ devices });
  } catch (error) {
    logger.error({ error }, 'Error fetching devices from space');
    res.status(500).json({ error: 'Failed to fetch devices from space' });
  }
});

/**
 * POST /api/tuya/spaces/:spaceId/import
 * Import devices from a specific Tuya space into the local database
 */
router.post('/spaces/:spaceId/import', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { spaceId } = req.params;
    if (!spaceId) {
      return res.status(400).json({ error: 'Space ID is required' });
    }

    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Tuya credentials not configured' });
    }

    // Fetch devices from the space
    const tuyaDevices = await tuyaCloudClient.getDevicesFromSpace(
      credentials.accessId,
      credentials.accessSecret,
      credentials.endpoint,
      spaceId
    );

    const imported: string[] = [];
    const skipped: string[] = [];

    // Map Tuya category to device type
    const categoryToType: Record<string, string> = {
      'cz': 'plug',      // Socket/Plug
      'kg': 'switch',    // Switch
      'dj': 'light',     // Light
      'dd': 'light',     // Light
      'xdd': 'light',    // Ceiling light
      'fwd': 'light',    // Ambient light
      'dc': 'light',     // Light string
      'qn': 'heater',    // Heater
      'rs': 'hot_water', // Water heater
      'wk': 'thermostat', // Thermostat
      'wkf': 'thermostat', // Thermostat
    };

    // Get existing devices once before the loop
    const existingDevices = devicesRepo.getAllDevices(userId);

    for (const device of tuyaDevices) {
      // Check if device already exists
      const exists = existingDevices.some(d => d.config.deviceId === device.id);

      if (exists) {
        skipped.push(device.custom_name || device.name);
        continue;
      }

      // Determine device type from category
      const deviceType = (categoryToType[device.category] || 'plug') as DeviceType;

      // Create the device
      devicesRepo.createDevice({
        name: device.custom_name || device.name,
        type: deviceType,
        config: {
          deviceId: device.id,
          localKey: device.local_key,
          category: device.category,
          productId: device.product_id,
          icon: device.icon,
        },
      }, userId);

      imported.push(device.custom_name || device.name);
    }

    logger.info({ userId, spaceId, imported: imported.length, skipped: skipped.length }, 'Imported devices from Tuya space');

    res.json({
      message: `Imported ${imported.length} devices, skipped ${skipped.length} existing`,
      imported,
      skipped,
      total: tuyaDevices.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error importing devices from space');
    res.status(500).json({ error: 'Failed to import devices from space' });
  }
});

export default router;
