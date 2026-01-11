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
export function getSettings(userId: string): AppSettings {
  const db = getDb();
  const rows = db.select().from(schema.settings).where(eq(schema.settings.userId, userId)).all();

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
export function getSetting(key: string, userId: string): string | null {
  const db = getDb();
  const result = db
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)))
    .get();

  return result?.value ?? null;
}

/**
 * Set a single setting for a user
 */
export function setSetting(key: string, value: string, userId: string): void {
  const db = getDb();
  const existing = getSetting(key, userId);

  if (existing !== null) {
    db.update(schema.settings)
      .set({
        value,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(schema.settings.key, key), eq(schema.settings.userId, userId)))
      .run();
  } else {
    db.insert(schema.settings)
      .values({
        userId,
        key,
        value,
        updatedAt: new Date().toISOString(),
      })
      .run();
  }
}

/**
 * Update multiple settings for a user
 */
export function updateSettings(updates: Partial<AppSettings>, userId: string): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setSetting(key, value, userId);
    }
  }
}
