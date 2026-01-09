import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Device,
  DeviceConfig,
  CreateDeviceInput,
  UpdateDeviceInput,
  DeviceStatus,
} from '@octopus-controller/shared';

/**
 * Parse device config from JSON string
 */
function parseConfig(configJson: string): DeviceConfig {
  try {
    return JSON.parse(configJson);
  } catch {
    return {};
  }
}

/**
 * Map database row to Device entity
 */
function mapRowToDevice(row: typeof schema.devices.$inferSelect): Device {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Device['type'],
    protocol: row.protocol as Device['protocol'],
    config: parseConfig(row.config),
    status: (row.status || 'unknown') as DeviceStatus,
    lastSeen: row.lastSeen || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

/**
 * Get all devices for a user
 */
export function getAllDevices(userId?: string): Device[] {
  const db = getDb();
  if (userId) {
    const rows = db.select().from(schema.devices).where(eq(schema.devices.userId, userId)).all();
    return rows.map(mapRowToDevice);
  }
  // Fallback for unauthenticated access (when auth is disabled)
  const rows = db.select().from(schema.devices).all();
  return rows.map(mapRowToDevice);
}

/**
 * Get a device by ID (optionally scoped to user)
 */
export function getDeviceById(id: string, userId?: string): Device | null {
  const db = getDb();
  let row;
  if (userId) {
    row = db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)))
      .get();
  } else {
    row = db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id))
      .get();
  }

  return row ? mapRowToDevice(row) : null;
}

/**
 * Create a new device for a user
 */
export function createDevice(input: CreateDeviceInput, userId: string): Device {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.insert(schema.devices)
    .values({
      id,
      userId,
      name: input.name,
      type: input.type,
      protocol: input.protocol,
      config: JSON.stringify(input.config),
      status: 'unknown',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getDeviceById(id)!;
}

/**
 * Update a device (optionally scoped to user)
 */
export function updateDevice(id: string, input: UpdateDeviceInput, userId?: string): Device | null {
  const db = getDb();
  const existing = getDeviceById(id, userId);

  if (!existing) {
    return null;
  }

  const updates: Partial<typeof schema.devices.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.type !== undefined) {
    updates.type = input.type;
  }

  if (input.config !== undefined) {
    // Merge with existing config
    const newConfig = { ...existing.config, ...input.config };
    updates.config = JSON.stringify(newConfig);
  }

  if (userId) {
    db.update(schema.devices)
      .set(updates)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)))
      .run();
  } else {
    db.update(schema.devices)
      .set(updates)
      .where(eq(schema.devices.id, id))
      .run();
  }

  return getDeviceById(id, userId);
}

/**
 * Delete a device (optionally scoped to user)
 */
export function deleteDevice(id: string, userId?: string): boolean {
  const db = getDb();
  let result;
  if (userId) {
    result = db
      .delete(schema.devices)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)))
      .run();
  } else {
    result = db
      .delete(schema.devices)
      .where(eq(schema.devices.id, id))
      .run();
  }

  return result.changes > 0;
}

/**
 * Update device status
 */
export function updateDeviceStatus(id: string, status: DeviceStatus): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.update(schema.devices)
    .set({
      status,
      lastSeen: status === 'online' ? now : undefined,
      updatedAt: now,
    })
    .where(eq(schema.devices.id, id))
    .run();
}
