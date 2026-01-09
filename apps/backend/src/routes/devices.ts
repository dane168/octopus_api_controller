import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as devicesRepo from '../repositories/devices.js';
import * as tuyaService from '../services/tuya/index.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';

export const deviceRoutes = Router();

// Apply optional auth to all routes
deviceRoutes.use(optionalAuth);

// Validation schemas
const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['switch', 'plug', 'light', 'heater', 'thermostat', 'hot_water'] as const),
  protocol: z.enum(['tuya-local', 'mock'] as const),
  config: z.object({
    deviceId: z.string().min(1),
    localKey: z.string().min(1),
    ip: z.string().optional(),
    version: z.enum(['3.1', '3.3', '3.4'] as const).optional(),
  }),
  skipConnectionTest: z.boolean().optional(),
});

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['switch', 'plug', 'light', 'heater', 'thermostat', 'hot_water'] as const).optional(),
  config: z.object({
    deviceId: z.string().optional(),
    localKey: z.string().optional(),
    ip: z.string().optional(),
    version: z.enum(['3.1', '3.3', '3.4'] as const).optional(),
  }).optional(),
});

const controlDeviceSchema = z.object({
  action: z.enum(['on', 'off', 'toggle'] as const),
});

const testConnectionSchema = z.object({
  deviceId: z.string().min(1),
  localKey: z.string().min(1),
  ip: z.string().optional(),
  version: z.enum(['3.1', '3.3', '3.4'] as const).optional(),
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

// POST /api/devices/test-connection - Test device connection without saving
// NOTE: Must be before /:id routes to avoid route conflict
deviceRoutes.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const validation = testConnectionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid config data',
        details: validation.error.errors,
      });
    }

    const success = await tuyaService.testDeviceConnection(validation.data);

    res.json({ success });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, message: errorMessage }, 'Connection test failed');
    res.status(500).json({ error: `Connection test failed: ${errorMessage}`, success: false });
  }
});

// POST /api/devices/import - Bulk import devices from Tuya JSON export
// NOTE: Must be before /:id routes to avoid route conflict
deviceRoutes.post('/import', async (req: Request, res: Response) => {
  try {
    const importSchema = z.object({
      devices: z.array(z.object({
        id: z.string(),
        custom_name: z.string().optional(),
        name: z.string(),
        local_key: z.string(),
        ip: z.string().optional(),
        category: z.string(),
        is_online: z.boolean().optional(),
      })),
    });

    const validation = importSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid import data',
        details: validation.error.errors,
      });
    }

    // Map Tuya categories to our device types
    const categoryToType: Record<string, string> = {
      'cz': 'plug',      // Smart plug
      'dj': 'light',     // Light bulb/LED
      'tdq': 'heater',   // Breaker/relay (often used for heaters)
      'kg': 'switch',    // Switch
      'tgq': 'light',    // Dimmer/light
      'dd': 'light',     // LED strip
    };

    const imported: string[] = [];
    const skipped: string[] = [];

    const userId = req.userId || 'legacy';

    for (const tuyaDevice of validation.data.devices) {
      // Check if device already exists by tuya device ID for this user
      const allDevices = devicesRepo.getAllDevices(req.userId);
      const existing = allDevices.find(d => d.config.deviceId === tuyaDevice.id);
      if (existing) {
        skipped.push(tuyaDevice.custom_name || tuyaDevice.name);
        continue;
      }

      const deviceType = categoryToType[tuyaDevice.category] || 'switch';

      devicesRepo.createDevice({
        name: tuyaDevice.custom_name || tuyaDevice.name,
        type: deviceType as 'switch' | 'plug' | 'light' | 'heater' | 'thermostat' | 'hot_water',
        protocol: 'tuya-local',
        config: {
          deviceId: tuyaDevice.id,
          localKey: tuyaDevice.local_key,
          // Don't use the IP from Tuya - it's the public IP, not local
        },
      }, userId);

      imported.push(tuyaDevice.custom_name || tuyaDevice.name);
    }

    logger.info({ imported: imported.length, skipped: skipped.length }, 'Devices imported');

    res.json({
      message: `Imported ${imported.length} devices, skipped ${skipped.length} existing`,
      imported,
      skipped,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, message: errorMessage }, 'Failed to import devices');
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
    const validation = createDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid device data',
        details: validation.error.errors,
      });
    }

    const { skipConnectionTest, ...input } = validation.data;

    // Test connection before saving (unless skipped)
    if (input.protocol === 'tuya-local' && !skipConnectionTest) {
      const connectionOk = await tuyaService.testDeviceConnection(input.config);
      if (!connectionOk) {
        return res.status(400).json({
          error: 'Could not connect to device. Please check device ID, local key, IP address, and that the device is online. You can skip this test by checking "Skip connection test".',
        });
      }
    }

    const userId = req.userId || 'legacy';
    const device = devicesRepo.createDevice(input, userId);
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
