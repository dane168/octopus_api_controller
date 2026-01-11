import { eq, and, desc } from 'drizzle-orm';
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
export async function getAllSchedules(userId?: string): Promise<Schedule[]> {
  const db = getDb();
  let rows;
  if (userId) {
    rows = await db.select().from(schema.schedules).where(eq(schema.schedules.userId, userId));
  } else {
    rows = await db.select().from(schema.schedules);
  }
  return rows.map(mapRowToSchedule);
}

/**
 * Get all schedules with device info for a user
 */
export async function getAllSchedulesWithDevices(userId?: string): Promise<ScheduleWithDevices[]> {
  const schedules = await getAllSchedules(userId);

  const result: ScheduleWithDevices[] = [];
  for (const schedule of schedules) {
    const devices: { id: string; name: string }[] = [];
    for (const deviceId of schedule.deviceIds) {
      const device = await getDeviceById(deviceId);
      if (device) {
        devices.push({ id: device.id, name: device.name });
      }
    }
    result.push({
      ...schedule,
      devices,
    });
  }

  return result;
}

/**
 * Get a schedule by ID (optionally scoped to user)
 */
export async function getScheduleById(id: string, userId?: string): Promise<Schedule | null> {
  const db = getDb();
  let rows;
  if (userId) {
    rows = await db
      .select()
      .from(schema.schedules)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)));
  } else {
    rows = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, id));
  }

  return rows.length > 0 ? mapRowToSchedule(rows[0]) : null;
}

/**
 * Get enabled schedules (for the cron job - runs across all users)
 */
export async function getEnabledSchedules(): Promise<Schedule[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.enabled, true));
  return rows.map(mapRowToSchedule);
}

/**
 * Create a new schedule for a user
 */
export async function createSchedule(input: CreateScheduleInput, userId: string): Promise<Schedule> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.insert(schema.schedules)
    .values({
      id,
      userId,
      deviceIds: JSON.stringify(input.deviceIds),
      name: input.name,
      enabled: true,
      config: JSON.stringify(input.config),
      createdAt: now,
      updatedAt: now,
    });

  const schedule = await getScheduleById(id);
  return schedule!;
}

/**
 * Update a schedule (optionally scoped to user)
 */
export async function updateSchedule(id: string, input: UpdateScheduleInput, userId?: string): Promise<Schedule | null> {
  const db = getDb();
  const existing = await getScheduleById(id, userId);

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
    await db.update(schema.schedules)
      .set(updates)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)));
  } else {
    await db.update(schema.schedules)
      .set(updates)
      .where(eq(schema.schedules.id, id));
  }

  return getScheduleById(id, userId);
}

/**
 * Toggle a schedule's enabled state (optionally scoped to user)
 */
export async function toggleSchedule(id: string, userId?: string): Promise<Schedule | null> {
  const existing = await getScheduleById(id, userId);
  if (!existing) {
    return null;
  }

  return updateSchedule(id, { enabled: !existing.enabled }, userId);
}

/**
 * Delete a schedule (optionally scoped to user)
 */
export async function deleteSchedule(id: string, userId?: string): Promise<boolean> {
  const db = getDb();

  // Check if schedule exists first
  const existing = await getScheduleById(id, userId);
  if (!existing) {
    return false;
  }

  if (userId) {
    await db
      .delete(schema.schedules)
      .where(and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)));
  } else {
    await db
      .delete(schema.schedules)
      .where(eq(schema.schedules.id, id));
  }

  return true;
}

/**
 * Create a schedule log entry
 */
export async function createScheduleLog(log: Omit<ScheduleLog, 'id' | 'executedAt'>): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.insert(schema.scheduleLogs)
    .values({
      scheduleId: log.scheduleId,
      deviceId: log.deviceId,
      action: log.action,
      triggerReason: log.triggerReason,
      success: log.success,
      errorMessage: log.errorMessage || null,
      executedAt: now,
    });
}

/**
 * Get schedule logs
 */
export async function getScheduleLogs(scheduleId: string, limit = 50): Promise<ScheduleLog[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.scheduleLogs)
    .where(eq(schema.scheduleLogs.scheduleId, scheduleId))
    .orderBy(desc(schema.scheduleLogs.executedAt))
    .limit(limit);

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
export async function getAllScheduleLogs(limit = 100): Promise<ScheduleLog[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.scheduleLogs)
    .orderBy(desc(schema.scheduleLogs.executedAt))
    .limit(limit);

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
