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
    return { deviceId: '' };
  }
}

/**
 * Map database row to Device entity
 */
function mapRowToDevice(row: typeof schema.devices.$inferSelect): Device {
  return {
    id: row.id,
    userId: row.userId,
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
export async function getAllDevices(userId?: string): Promise<Device[]> {
  const db = getDb();
  if (userId) {
    const rows = await db.select().from(schema.devices).where(eq(schema.devices.userId, userId));
    return rows.map(mapRowToDevice);
  }
  // Fallback for unauthenticated access (when auth is disabled)
  const rows = await db.select().from(schema.devices);
  return rows.map(mapRowToDevice);
}

/**
 * Get a device by ID (optionally scoped to user)
 */
export async function getDeviceById(id: string, userId?: string): Promise<Device | null> {
  const db = getDb();
  let rows;
  if (userId) {
    rows = await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)));
  } else {
    rows = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id));
  }

  return rows.length > 0 ? mapRowToDevice(rows[0]) : null;
}

/**
 * Create a new device for a user
 */
export async function createDevice(input: CreateDeviceInput, userId: string): Promise<Device> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.insert(schema.devices)
    .values({
      id,
      userId,
      name: input.name,
      type: input.type,
      protocol: 'tuya-cloud', // Always use tuya-cloud
      config: JSON.stringify(input.config),
      status: 'unknown',
      createdAt: now,
      updatedAt: now,
    });

  const device = await getDeviceById(id);
  return device!;
}

/**
 * Update a device (optionally scoped to user)
 */
export async function updateDevice(id: string, input: UpdateDeviceInput, userId?: string): Promise<Device | null> {
  const db = getDb();
  const existing = await getDeviceById(id, userId);

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
    await db.update(schema.devices)
      .set(updates)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)));
  } else {
    await db.update(schema.devices)
      .set(updates)
      .where(eq(schema.devices.id, id));
  }

  return getDeviceById(id, userId);
}

/**
 * Delete a device (optionally scoped to user)
 */
export async function deleteDevice(id: string, userId?: string): Promise<boolean> {
  const db = getDb();

  // Check if device exists first
  const existing = await getDeviceById(id, userId);
  if (!existing) {
    return false;
  }

  if (userId) {
    await db
      .delete(schema.devices)
      .where(and(eq(schema.devices.id, id), eq(schema.devices.userId, userId)));
  } else {
    await db
      .delete(schema.devices)
      .where(eq(schema.devices.id, id));
  }

  return true;
}

/**
 * Update device status
 */
export async function updateDeviceStatus(id: string, status: DeviceStatus): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.update(schema.devices)
    .set({
      status,
      lastSeen: status === 'online' ? now : undefined,
      updatedAt: now,
    })
    .where(eq(schema.devices.id, id));
}
