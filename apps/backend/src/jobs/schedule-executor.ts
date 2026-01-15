import cron from 'node-cron';
import * as scheduleRepo from '../repositories/schedules.js';
import * as devicesRepo from '../repositories/devices.js';
import * as tuyaService from '../services/tuya/index.js';
import { logger } from '../utils/logger.js';
import type { Schedule, TimeSlotsConfig, DeviceAction } from '@octopus-controller/shared';

/**
 * Check if a time slot matches the current time
 */
function isTimeSlotActive(slot: { start: string; end: string }, now: Date): boolean {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMin] = slot.start.split(':').map(Number);
  const [endHour, endMin] = slot.end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight slots (e.g., 23:00 - 00:30)
  if (endMinutes < startMinutes) {
    return currentTimeMinutes >= startMinutes || currentTimeMinutes < endMinutes;
  }

  return currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes;
}

/**
 * Check if any time slot in the schedule is active
 */
function hasActiveSlot(config: TimeSlotsConfig, now: Date): boolean {
  return config.slots.some((slot) => isTimeSlotActive(slot, now));
}

/**
 * Check if it's the exact start of a slot (at the exact minute)
 */
function isSlotStart(slot: { start: string; end: string }, now: Date): boolean {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMin] = slot.start.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;

  // Check if we're at the exact start minute of the slot
  return currentTimeMinutes === startMinutes;
}

/**
 * Check if it's the exact end of a slot (at the exact minute)
 */
function isSlotEnd(slot: { start: string; end: string }, now: Date): boolean {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [endHour, endMin] = slot.end.split(':').map(Number);
  let endMinutes = endHour * 60 + endMin;

  // Handle midnight (00:00 means end of day)
  if (endMinutes === 0) {
    endMinutes = 24 * 60;
  }

  // Check if we're at the exact end minute of the slot
  return currentTimeMinutes === endMinutes;
}

/**
 * Execute a device action and log the result
 */
async function executeDeviceAction(
  scheduleId: string,
  deviceId: string,
  action: DeviceAction,
  reason: string
): Promise<boolean> {
  try {
    const device = await devicesRepo.getDeviceById(deviceId);

    if (!device) {
      logger.warn({ scheduleId, deviceId }, 'Device not found for schedule execution');
      await scheduleRepo.createScheduleLog({
        scheduleId,
        deviceId,
        action,
        triggerReason: reason,
        success: false,
        errorMessage: 'Device not found',
      });
      return false;
    }

    await tuyaService.controlDevice(device, action);

    // Update device status
    await devicesRepo.updateDeviceStatus(deviceId, 'online');

    // Log success
    await scheduleRepo.createScheduleLog({
      scheduleId,
      deviceId,
      action,
      triggerReason: reason,
      success: true,
    });

    logger.info({ scheduleId, deviceId, deviceName: device.name, action, reason }, 'Schedule action executed');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update device status
    await devicesRepo.updateDeviceStatus(deviceId, 'offline');

    // Log failure
    await scheduleRepo.createScheduleLog({
      scheduleId,
      deviceId,
      action,
      triggerReason: reason,
      success: false,
      errorMessage,
    });

    logger.error({ scheduleId, deviceId, action, error: errorMessage }, 'Schedule action failed');
    return false;
  }
}

/**
 * Process a time_slots schedule
 */
async function processTimeSlotsSchedule(schedule: Schedule): Promise<void> {
  const config = schedule.config as TimeSlotsConfig;
  const now = new Date();

  // For 'once' schedules, check the date
  if (config.repeat === 'once' && config.date) {
    const scheduleDate = config.date;
    const todayDate = now.toISOString().split('T')[0];

    if (scheduleDate !== todayDate) {
      // Not the right day for this one-time schedule
      return;
    }
  }

  // Check each slot for start/end transitions
  for (const slot of config.slots) {
    if (isSlotStart(slot, now)) {
      // Slot is starting
      const action = config.action;
      const reason = `Slot ${slot.start}-${slot.end} started`;

      for (const deviceId of schedule.deviceIds) {
        await executeDeviceAction(schedule.id, deviceId, action, reason);
      }

      // For 'once' schedules, disable after execution
      if (config.repeat === 'once') {
        await scheduleRepo.updateSchedule(schedule.id, { enabled: false });
        logger.info({ scheduleId: schedule.id }, 'One-time schedule disabled after execution');
      }
    } else if (isSlotEnd(slot, now) && config.action !== 'toggle') {
      // Slot is ending - turn off devices (only for on/off actions, not toggle)
      // Only turn off if the action was 'on' (we want to reverse the action)
      if (config.action === 'on') {
        const reason = `Slot ${slot.start}-${slot.end} ended`;

        for (const deviceId of schedule.deviceIds) {
          await executeDeviceAction(schedule.id, deviceId, 'off', reason);
        }
      }
    }
  }
}

/**
 * Evaluate and execute all enabled schedules
 */
async function evaluateSchedules(): Promise<void> {
  try {
    const enabledSchedules = await scheduleRepo.getEnabledSchedules();

    for (const schedule of enabledSchedules) {
      try {
        if (schedule.config.type === 'time_slots') {
          await processTimeSlotsSchedule(schedule);
        }
        // Other schedule types can be added here later
        // (price_threshold, cheapest_hours, time_range)
      } catch (error) {
        logger.error({ scheduleId: schedule.id, error }, 'Failed to process schedule');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to evaluate schedules');
  }
}

/**
 * Schedule executor job
 * Runs every minute to check and execute schedules
 */
export const scheduleExecutorJob = cron.schedule(
  '* * * * *', // Every minute
  async () => {
    logger.debug('Running schedule executor');
    await evaluateSchedules();
  },
  {
    timezone: 'Europe/London',
    scheduled: false, // Don't start automatically - started via startScheduleJobs()
  }
);

/**
 * Start the schedule executor
 */
export function startScheduleExecutor(): void {
  scheduleExecutorJob.start();
  logger.info('Schedule executor started');
}

/**
 * Stop the schedule executor
 */
export function stopScheduleExecutor(): void {
  scheduleExecutorJob.stop();
  logger.info('Schedule executor stopped');
}
