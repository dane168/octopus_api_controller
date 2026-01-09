import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Schedule,
  ScheduleConfig,
  ScheduleWithDevices,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleLog,
} from '@octopus-controller/shared';
import { getDeviceById } from './devices.js';

/**
 * Parse schedule config from JSON string
 */
function parseConfig(configJson: string): ScheduleConfig {
  try {
    return JSON.parse(configJson);
  } catch {
    return { type: 'time_slots', slots: [], action: 'on', repeat: 'daily' };
  }
}

/**
 * Parse device IDs from JSON string
 */
function parseDeviceIds(deviceIdsJson: string): string[] {
  try {
    return JSON.parse(deviceIdsJson);
  } catch {
    return [];
  }
}

/**
 * Map database row to Schedule entity
 */
function mapRowToSchedule(row: typeof schema.schedules.$inferSelect): Schedule {
  return {
    id: row.id,
    deviceIds: parseDeviceIds(row.deviceIds),
    name: row.name,
    enabled: row.enabled ?? true,
    config: parseConfig(row.config),
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

/**
 * Get all schedules for a user
 */
export function getAllSchedules(userId?: string): Schedule[] {
  const db = getDb();
  if (userId) {
    const rows = db.select().from(schema.schedules).where(eq(schema.schedules.userId, userId)).all();
    return rows.map(mapRowToSchedule);
  }
  const rows = db.select().from(schema.schedules).all();
  return rows.map(mapRowToSchedule);
}

/**
 * Get all schedules with device info for a user
 */
export function getAllSchedulesWithDevices(userId?: string): ScheduleWithDevices[] {
  const schedules = getAllSchedules(userId);

  return schedules.map((schedule) => {
    const devices = schedule.deviceIds
      .map((deviceId) => {
        const device = getDeviceById(deviceId);
        return device ? { id: device.id, name: device.name } : null;
      })
      .filter((d): d is { id: string; name: string } => d !== null);

    return {
      ...schedule,
      devices,
    };
  });
}

/**
 * Get a schedule by ID (optionally scoped to user)
 */
export function getScheduleById(id: string, userId?: string): Schedule | null {
  const db = getDb();
  let row;
  if (userId) {
    row = db
      .select()
      .from(schema.schedules)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)))
      .get();
  } else {
    row = db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, id))
      .get();
  }

  return row ? mapRowToSchedule(row) : null;
}

/**
 * Get enabled schedules (for the cron job - runs across all users)
 */
export function getEnabledSchedules(): Schedule[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.enabled, true))
    .all();
  return rows.map(mapRowToSchedule);
}

/**
 * Create a new schedule for a user
 */
export function createSchedule(input: CreateScheduleInput, userId: string): Schedule {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.insert(schema.schedules)
    .values({
      id,
      userId,
      deviceIds: JSON.stringify(input.deviceIds),
      name: input.name,
      enabled: true,
      config: JSON.stringify(input.config),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getScheduleById(id)!;
}

/**
 * Update a schedule (optionally scoped to user)
 */
export function updateSchedule(id: string, input: UpdateScheduleInput, userId?: string): Schedule | null {
  const db = getDb();
  const existing = getScheduleById(id, userId);

  if (!existing) {
    return null;
  }

  const updates: Partial<typeof schema.schedules.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.deviceIds !== undefined) {
    updates.deviceIds = JSON.stringify(input.deviceIds);
  }

  if (input.config !== undefined) {
    updates.config = JSON.stringify(input.config);
  }

  if (input.enabled !== undefined) {
    updates.enabled = input.enabled;
  }

  if (userId) {
    db.update(schema.schedules)
      .set(updates)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)))
      .run();
  } else {
    db.update(schema.schedules)
      .set(updates)
      .where(eq(schema.schedules.id, id))
      .run();
  }

  return getScheduleById(id, userId);
}

/**
 * Toggle a schedule's enabled state (optionally scoped to user)
 */
export function toggleSchedule(id: string, userId?: string): Schedule | null {
  const existing = getScheduleById(id, userId);
  if (!existing) {
    return null;
  }

  return updateSchedule(id, { enabled: !existing.enabled }, userId);
}

/**
 * Delete a schedule (optionally scoped to user)
 */
export function deleteSchedule(id: string, userId?: string): boolean {
  const db = getDb();
  let result;
  if (userId) {
    result = db
      .delete(schema.schedules)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)))
      .run();
  } else {
    result = db
      .delete(schema.schedules)
      .where(eq(schema.schedules.id, id))
      .run();
  }

  return result.changes > 0;
}

/**
 * Create a schedule log entry
 */
export function createScheduleLog(log: Omit<ScheduleLog, 'id' | 'executedAt'>): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.insert(schema.scheduleLogs)
    .values({
      scheduleId: log.scheduleId,
      deviceId: log.deviceId,
      action: log.action,
      triggerReason: log.triggerReason,
      success: log.success,
      errorMessage: log.errorMessage || null,
      executedAt: now,
    })
    .run();
}

/**
 * Get schedule logs
 */
export function getScheduleLogs(scheduleId: string, limit = 50): ScheduleLog[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.scheduleLogs)
    .where(eq(schema.scheduleLogs.scheduleId, scheduleId))
    .orderBy(schema.scheduleLogs.executedAt)
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    scheduleId: row.scheduleId,
    deviceId: row.deviceId,
    action: row.action as 'on' | 'off' | 'toggle',
    triggerReason: row.triggerReason || '',
    success: row.success,
    errorMessage: row.errorMessage || undefined,
    executedAt: row.executedAt || new Date().toISOString(),
  }));
}

/**
 * Get all schedule logs (across all schedules)
 */
export function getAllScheduleLogs(limit = 100): ScheduleLog[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.scheduleLogs)
    .orderBy(schema.scheduleLogs.executedAt)
    .limit(limit)
    .all();

  // Return in reverse order (most recent first)
  return rows.reverse().map((row) => ({
    id: row.id,
    scheduleId: row.scheduleId,
    deviceId: row.deviceId,
    action: row.action as 'on' | 'off' | 'toggle',
    triggerReason: row.triggerReason || '',
    success: row.success,
    errorMessage: row.errorMessage || undefined,
    executedAt: row.executedAt || new Date().toISOString(),
  }));
}
