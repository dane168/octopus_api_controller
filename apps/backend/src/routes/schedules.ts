import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as scheduleRepo from '../repositories/schedules.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';

export const scheduleRoutes = Router();

// Apply optional auth to all routes
scheduleRoutes.use(optionalAuth);

// Validation schemas
const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const timeSlotsConfigSchema = z.object({
  type: z.literal('time_slots'),
  slots: z.array(timeSlotSchema).min(1),
  action: z.enum(['on', 'off', 'toggle']),
  repeat: z.enum(['once', 'daily']),
  date: z.string().optional(),
});

const priceThresholdConfigSchema = z.object({
  type: z.literal('price_threshold'),
  maxPrice: z.number(),
  minRuntime: z.number().optional(),
});

const cheapestHoursConfigSchema = z.object({
  type: z.literal('cheapest_hours'),
  hours: z.number().min(0.5).max(24),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/),
  consecutive: z.boolean().optional(),
});

const timeRangeConfigSchema = z.object({
  type: z.literal('time_range'),
  ranges: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().min(0).max(6)).optional(),
  })),
});

const scheduleConfigSchema = z.discriminatedUnion('type', [
  timeSlotsConfigSchema,
  priceThresholdConfigSchema,
  cheapestHoursConfigSchema,
  timeRangeConfigSchema,
]);

const createScheduleSchema = z.object({
  deviceIds: z.array(z.string()).min(1),
  name: z.string().min(1),
  config: scheduleConfigSchema,
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  deviceIds: z.array(z.string()).min(1).optional(),
  config: scheduleConfigSchema.optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/schedules
 * Get all schedules with device info for the current user
 */
scheduleRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const schedules = await scheduleRepo.getAllSchedulesWithDevices(req.userId);
    res.json({ schedules });
  } catch (error) {
    logger.error({ error }, 'Failed to get schedules');
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

/**
 * GET /api/schedules/logs/all
 * Get all schedule execution logs (across all schedules for the user)
 * Note: This route must come before /:id routes to avoid "logs" being treated as an ID
 */
scheduleRoutes.get('/logs/all', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await scheduleRepo.getAllScheduleLogs(limit);

    // Enrich logs with schedule and device names (only show user's schedules)
    const schedules = await scheduleRepo.getAllSchedulesWithDevices(req.userId);
    const scheduleMap = new Map(schedules.map(s => [s.id, s]));

    // Filter logs to only those belonging to user's schedules
    const userLogs = logs.filter(log => scheduleMap.has(log.scheduleId));

    const enrichedLogs = userLogs.map(log => {
      const schedule = scheduleMap.get(log.scheduleId);
      return {
        ...log,
        scheduleName: schedule?.name || 'Deleted Schedule',
        deviceName: schedule?.devices.find(d => d.id === log.deviceId)?.name || log.deviceId.slice(0, 8),
      };
    });

    res.json({ logs: enrichedLogs });
  } catch (error) {
    logger.error({ error }, 'Failed to get all schedule logs');
    res.status(500).json({ error: 'Failed to get schedule logs' });
  }
});

/**
 * GET /api/schedules/:id
 * Get a single schedule
 */
scheduleRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleRepo.getScheduleById(req.params.id, req.userId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ schedule });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to get schedule');
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

/**
 * POST /api/schedules
 * Create a new schedule
 */
scheduleRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createScheduleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid schedule data',
        details: validation.error.errors,
      });
    }

    logger.info({ input: validation.data }, 'Creating schedule');

    const userId = req.userId || 'legacy';
    const schedule = await scheduleRepo.createSchedule(validation.data, userId);

    res.status(201).json({ schedule });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, message: errorMessage }, 'Failed to create schedule');
    res.status(500).json({ error: `Failed to create schedule: ${errorMessage}` });
  }
});

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
scheduleRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const validation = updateScheduleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid schedule data',
        details: validation.error.errors,
      });
    }

    const schedule = await scheduleRepo.updateSchedule(req.params.id, validation.data, req.userId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info({ scheduleId: schedule.id }, 'Schedule updated');
    res.json({ schedule });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to update schedule');
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
scheduleRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await scheduleRepo.deleteSchedule(req.params.id, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info({ scheduleId: req.params.id }, 'Schedule deleted');
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to delete schedule');
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * POST /api/schedules/:id/toggle
 * Toggle a schedule's enabled state
 */
scheduleRoutes.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleRepo.toggleSchedule(req.params.id, req.userId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    logger.info({ scheduleId: schedule.id, enabled: schedule.enabled }, 'Schedule toggled');
    res.json({ schedule });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to toggle schedule');
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

/**
 * GET /api/schedules/:id/logs
 * Get schedule execution logs
 */
scheduleRoutes.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleRepo.getScheduleById(req.params.id, req.userId);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await scheduleRepo.getScheduleLogs(req.params.id, limit);

    res.json({ logs });
  } catch (error) {
    logger.error({ error, scheduleId: req.params.id }, 'Failed to get schedule logs');
    res.status(500).json({ error: 'Failed to get schedule logs' });
  }
});
