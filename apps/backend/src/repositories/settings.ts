import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import type { AppSettings } from '@octopus-controller/shared';
import { config } from '../config/index.js';

const DEFAULT_SETTINGS: AppSettings = {
  region: '',
  octopusApiKey: '',
  octopusMpan: '',
  octopusSerial: '',
};

/**
 * Get all settings for a user
 * @param userId - Required user ID to get settings for (prevents cross-user data leakage)
 */
export async function getSettings(userId: string): Promise<AppSettings> {
  const db = getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.userId, userId));

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key in settings) {
      (settings as Record<string, string>)[row.key] = row.value;
    }
  }

  // Override region with env var if set (for legacy compatibility)
  if (config.OCTOPUS_REGION) {
    settings.region = config.OCTOPUS_REGION;
  }
  // API key, MPAN, and Serial are now only from DB, not .env

  return settings;
}

/**
 * Get a single setting for a user
 * @param key - Setting key to retrieve
 * @param userId - Required user ID (prevents cross-user data leakage)
 */
export async function getSetting(key: string, userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)));

  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Set a single setting for a user
 */
export async function setSetting(key: string, value: string, userId: string): Promise<void> {
  const db = getDb();
  const existing = await getSetting(key, userId);

  if (existing !== null) {
    await db.update(schema.settings)
      .set({
        value,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)));
  } else {
    await db.insert(schema.settings)
      .values({
        userId,
        key,
        value,
        updatedAt: new Date().toISOString(),
      });
  }
}

/**
 * Update multiple settings for a user
 */
export async function updateSettings(updates: Partial<AppSettings>, userId: string): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      await setSetting(key, value, userId);
    }
  }
}

/**
 * Get all unique user IDs that have a region configured
 * Used by cron jobs to fetch prices for all configured users
 */
export async function getUserIdsWithRegion(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: schema.settings.userId, value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'region'));

  // Filter to only users with non-empty region
  return rows
    .filter(row => row.value && row.value.trim() !== '')
    .map(row => row.userId);
}
