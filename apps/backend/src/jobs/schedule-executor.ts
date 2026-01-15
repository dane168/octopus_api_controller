import cron from 'node-cron';
import * as scheduleRepo from '../repositories/schedules.js';
import * as devicesRepo from '../repositories/devices.js';
import * as tuyaService from '../services/tuya/index.js';
import { resolveSchedules } from '../services/schedule-resolver.js';
import { logger } from '../utils/logger.js';
import type { DeviceAction, EffectiveSlot, Schedule, TimeSlotsConfig } from '@octopus-controller/shared';

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/**
 * Check if it's the exact start of a slot (at the exact minute)
 */
function isSlotStart(slot: { start: string }, now: Date): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes === timeToMinutes(slot.start);
}

/**
 * Check if it's the exact end of a slot (at the exact minute)
 */
function isSlotEnd(slot: { end: string }, now: Date): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let endMinutes = timeToMinutes(slot.end);

  // Handle midnight (00:00 means end of day)
  if (endMinutes === 0) {
    endMinutes = 24 * 60;
  }

  return currentMinutes === endMinutes;
}

/**
 * Execute a device action and log the result
 * Now accepts multiple schedule IDs for merged slots
 */
async function executeDeviceAction(
  scheduleIds: string[],
  deviceId: string,
  action: DeviceAction,
  reason: string
): Promise<boolean> {
  try {
    const device = await devicesRepo.getDeviceById(deviceId);

    if (!device) {
      logger.warn({ scheduleIds, deviceId }, 'Device not found for schedule execution');
      // Log for first schedule
      if (scheduleIds.length > 0) {
        await scheduleRepo.createScheduleLog({
          scheduleId: scheduleIds[0],
          deviceId,
          action,
          triggerReason: reason,
          success: false,
          errorMessage: 'Device not found',
        });
      }
      return false;
    }

    await tuyaService.controlDevice(device, action);

    // Update device status
    await devicesRepo.updateDeviceStatus(deviceId, 'online');

    // Log success for all contributing schedules
    for (const scheduleId of scheduleIds) {
      await scheduleRepo.createScheduleLog({
        scheduleId,
        deviceId,
        action,
        triggerReason: reason,
        success: true,
      });
    }

    logger.info(
      { scheduleIds, deviceId, deviceName: device.name, action, reason },
      'Schedule action executed (merged)'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update device status
    await devicesRepo.updateDeviceStatus(deviceId, 'offline');

    // Log failure for all contributing schedules
    for (const scheduleId of scheduleIds) {
      await scheduleRepo.createScheduleLog({
        scheduleId,
        deviceId,
        action,
        triggerReason: reason,
        success: false,
        errorMessage,
      });
    }

    logger.error({ scheduleIds, deviceId, action, error: errorMessage }, 'Schedule action failed');
    return false;
  }
}

/**
 * Check and disable one-time schedules after execution
 */
async function disableOnceSchedulesIfNeeded(
  scheduleIds: string[],
  allSchedules: Schedule[]
): Promise<void> {
  for (const scheduleId of scheduleIds) {
    const schedule = allSchedules.find((s) => s.id === scheduleId);
    if (schedule && schedule.config.type === 'time_slots') {
      const config = schedule.config as TimeSlotsConfig;
      if (config.repeat === 'once') {
        await scheduleRepo.updateSchedule(scheduleId, { enabled: false });
        logger.info({ scheduleId }, 'One-time schedule disabled after execution');
      }
    }
  }
}

/**
 * Evaluate and execute all enabled schedules using merged/resolved slots
 * This prevents flickering when adjacent slots from different schedules
 * would otherwise turn a device off and immediately back on
 */
async function evaluateSchedules(): Promise<void> {
  try {
    const enabledSchedules = await scheduleRepo.getEnabledSchedules();
    const now = new Date();

    // Resolve all schedules into effective per-device schedules
    const { effectiveSchedules, conflicts } = await resolveSchedules(enabledSchedules);

    // Log any conflicts (but still execute - conflicts are just warnings)
    if (conflicts.length > 0) {
      logger.warn({ conflicts }, 'Schedule conflicts detected');
    }

    // Process each device's effective schedule
    for (const deviceSchedule of effectiveSchedules) {
      for (const slot of deviceSchedule.slots) {
        const scheduleIds = slot.sourceSchedules.map((s) => s.id);
        const scheduleNames = slot.sourceSchedules.map((s) => s.name).join(', ');

        if (isSlotStart(slot, now)) {
          // Slot is starting
          const reason = `Merged slot ${slot.start}-${slot.end} started (from: ${scheduleNames})`;
          await executeDeviceAction(scheduleIds, deviceSchedule.deviceId, slot.action, reason);

          // Disable one-time schedules after execution
          await disableOnceSchedulesIfNeeded(scheduleIds, enabledSchedules);
        } else if (isSlotEnd(slot, now) && slot.action === 'on') {
          // Slot is ending - turn off devices (only for 'on' actions)
          const reason = `Merged slot ${slot.start}-${slot.end} ended (from: ${scheduleNames})`;
          await executeDeviceAction(scheduleIds, deviceSchedule.deviceId, 'off', reason);
        }
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
