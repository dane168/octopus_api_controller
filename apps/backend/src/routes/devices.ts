import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as devicesRepo from '../repositories/devices.js';
import * as tuyaService from '../services/tuya/index.js';
import * as tuyaCredsRepo from '../repositories/tuya-credentials.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';

export const deviceRoutes = Router();

// Apply optional auth to all routes
deviceRoutes.use(optionalAuth);

// Validation schemas
const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['switch', 'plug', 'light', 'heater', 'thermostat', 'hot_water'] as const),
  config: z.object({
    deviceId: z.string().min(1),
  }),
});

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['switch', 'plug', 'light', 'heater', 'thermostat', 'hot_water'] as const).optional(),
  config: z.object({
    deviceId: z.string().optional(),
  }).optional(),
});

const controlDeviceSchema = z.object({
  action: z.enum(['on', 'off', 'toggle'] as const),
});

// GET /api/devices - List all devices for the current user
deviceRoutes.get('/', (req: Request, res: Response) => {
  try {
    const devices = devicesRepo.getAllDevices(req.userId);
    res.json({ devices });
  } catch (error) {
    logger.error({ error }, 'Failed to get devices');
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

// POST /api/devices/import-from-cloud - Import devices from Tuya Cloud
// NOTE: Must be before /:id routes to avoid route conflict
deviceRoutes.post('/import-from-cloud', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's Tuya credentials
    const credentials = await tuyaCredsRepo.getTuyaCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Tuya credentials not configured. Please add your Tuya API credentials in Settings first.' });
    }

    // Fetch devices from Tuya Cloud
    const tuyaDevices = await tuyaService.getTuyaDevices(
      credentials.accessId,
      credentials.accessSecret,
      credentials.endpoint
    );

    // Map Tuya categories to our device types
    const categoryToType: Record<string, string> = {
      'cz': 'plug',      // Smart plug
      'dj': 'light',     // Light bulb/LED
      'tdq': 'heater',   // Breaker/relay (often used for heaters)
      'kg': 'switch',    // Switch
      'tgq': 'light',    // Dimmer/light
      'dd': 'light',     // LED strip
      'pc': 'plug',      // Power strip
      'wk': 'thermostat', // Thermostat
    };

    const imported: string[] = [];
    const skipped: string[] = [];

    // Get existing devices to check for duplicates
    const existingDevices = devicesRepo.getAllDevices(userId);

    for (const tuyaDevice of tuyaDevices) {
      // Check if device already exists by Tuya device ID
      const existing = existingDevices.find(d => d.config.deviceId === tuyaDevice.id);
      if (existing) {
        skipped.push(tuyaDevice.name);
        continue;
      }

      const deviceType = categoryToType[tuyaDevice.category] || 'switch';

      devicesRepo.createDevice({
        name: tuyaDevice.name,
        type: deviceType as 'switch' | 'plug' | 'light' | 'heater' | 'thermostat' | 'hot_water',
        config: {
          deviceId: tuyaDevice.id,
        },
      }, userId);

      imported.push(tuyaDevice.name);
    }

    logger.info({ imported: imported.length, skipped: skipped.length }, 'Devices imported from Tuya Cloud');

    res.json({
      message: `Imported ${imported.length} devices, skipped ${skipped.length} existing`,
      imported,
      skipped,
      total: tuyaDevices.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, message: errorMessage }, 'Failed to import devices from Tuya Cloud');
    res.status(500).json({ error: `Failed to import devices: ${errorMessage}` });
  }
});

// GET /api/devices/:id - Get a single device
deviceRoutes.get('/:id', (req: Request, res: Response) => {
  try {
    const device = devicesRepo.getDeviceById(req.params.id, req.userId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (error) {
    logger.error({ error, deviceId: req.params.id }, 'Failed to get device');
    res.status(500).json({ error: 'Failed to get device' });
  }
});

// POST /api/devices - Create a new device
deviceRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = createDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid device data',
        details: validation.error.errors,
      });
    }

    const device = devicesRepo.createDevice(validation.data, userId);
    logger.info({ deviceId: device.id, name: device.name }, 'Device created');

    res.status(201).json({ device });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, message: errorMessage }, 'Failed to create device');
    res.status(500).json({ error: `Failed to create device: ${errorMessage}` });
  }
});

// PUT /api/devices/:id - Update a device
deviceRoutes.put('/:id', (req: Request, res: Response) => {
  try {
    const validation = updateDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid device data',
        details: validation.error.errors,
      });
    }

    const device = devicesRepo.updateDevice(req.params.id, validation.data, req.userId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    logger.info({ deviceId: device.id, name: device.name }, 'Device updated');
    res.json({ device });
  } catch (error) {
    logger.error({ error, deviceId: req.params.id }, 'Failed to update device');
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// DELETE /api/devices/:id - Delete a device
deviceRoutes.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = devicesRepo.deleteDevice(req.params.id, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Device not found' });
    }

    logger.info({ deviceId: req.params.id }, 'Device deleted');
    res.json({ success: true });
  } catch (error) {
    logger.error({ error, deviceId: req.params.id }, 'Failed to delete device');
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// POST /api/devices/:id/control - Control a device (on/off/toggle)
deviceRoutes.post('/:id/control', async (req: Request, res: Response) => {
  try {
    const validation = controlDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid control action',
        details: validation.error.errors,
      });
    }

    const device = devicesRepo.getDeviceById(req.params.id, req.userId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { action } = validation.data;
    const state = await tuyaService.controlDevice(device, action);

    // Update device status in database
    devicesRepo.updateDeviceStatus(device.id, 'online');

    logger.info({ deviceId: device.id, name: device.name, action, state }, 'Device controlled');
    res.json({ device, state });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, deviceId: req.params.id }, 'Failed to control device');

    // Update device status to offline if control failed
    devicesRepo.updateDeviceStatus(req.params.id, 'offline');

    res.status(500).json({ error: `Failed to control device: ${errorMessage}` });
  }
});

// GET /api/devices/:id/state - Get device current state
deviceRoutes.get('/:id/state', async (req: Request, res: Response) => {
  try {
    const device = devicesRepo.getDeviceById(req.params.id, req.userId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const state = await tuyaService.getDeviceState(device);

    // Update device status in database
    devicesRepo.updateDeviceStatus(device.id, 'online');

    res.json({ device, state });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, deviceId: req.params.id }, 'Failed to get device state');

    // Update device status to offline if failed
    devicesRepo.updateDeviceStatus(req.params.id, 'offline');

    res.status(500).json({ error: `Failed to get device state: ${errorMessage}` });
  }
});
