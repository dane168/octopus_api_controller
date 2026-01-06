import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import type { AppSettings } from '@octopus-controller/shared';
import { config } from '../config/index.js';

const DEFAULT_SETTINGS: AppSettings = {
  region: '',
};

/**
 * Get all settings
 */
export function getSettings(): AppSettings {
  const db = getDb();
  const rows = db.select().from(schema.settings).all();

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key in settings) {
      (settings as Record<string, string>)[row.key] = row.value;
    }
  }

  // Override with env vars if set
  if (config.OCTOPUS_REGION) {
    settings.region = config.OCTOPUS_REGION;
  }
  if (config.OCTOPUS_API_KEY) {
    settings.octopusApiKey = config.OCTOPUS_API_KEY;
  }
  if (config.OCTOPUS_MPAN) {
    settings.octopusMpan = config.OCTOPUS_MPAN;
  }
  if (config.OCTOPUS_SERIAL) {
    settings.octopusSerial = config.OCTOPUS_SERIAL;
  }

  return settings;
}

/**
 * Get a single setting
 */
export function getSetting(key: string): string | null {
  const db = getDb();
  const result = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .get();

  return result?.value ?? null;
}

/**
 * Set a single setting
 */
export function setSetting(key: string, value: string): void {
  const db = getDb();
  const existing = getSetting(key);

  if (existing !== null) {
    db.update(schema.settings)
      .set({
        value,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.settings.key, key))
      .run();
  } else {
    db.insert(schema.settings)
      .values({
        key,
        value,
        updatedAt: new Date().toISOString(),
      })
      .run();
  }
}

/**
 * Update multiple settings
 */
export function updateSettings(updates: Partial<AppSettings>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setSetting(key, value);
    }
  }
}
