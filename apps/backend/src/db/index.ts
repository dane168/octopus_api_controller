import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase() {
  // Ensure data directory exists
  const dbDir = dirname(config.DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory: ${dbDir}`);
  }

  // Initialize SQLite
  sqlite = new Database(config.DATABASE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Initialize Drizzle
  db = drizzle(sqlite, { schema });

  // Run migrations (create tables if they don't exist)
  await runMigrations();

  logger.info(`Database initialized at: ${config.DATABASE_PATH}`);
}

async function runMigrations() {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      value_inc_vat REAL NOT NULL,
      value_exc_vat REAL NOT NULL,
      region TEXT NOT NULL DEFAULT 'C',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(valid_from, region)
    );

    CREATE INDEX IF NOT EXISTS idx_prices_valid_from ON prices(valid_from);
    CREATE INDEX IF NOT EXISTS idx_prices_region ON prices(region);

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      protocol TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      last_seen TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_ids TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);

    CREATE TABLE IF NOT EXISTS schedule_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      action TEXT NOT NULL,
      trigger_reason TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_schedule_logs_executed ON schedule_logs(executed_at);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);
  `);

  // Migration: Rename device_id to device_ids if old column exists
  try {
    const tableInfo = sqlite.prepare("PRAGMA table_info(schedules)").all() as Array<{ name: string }>;
    const hasOldColumn = tableInfo.some(col => col.name === 'device_id');
    const hasNewColumn = tableInfo.some(col => col.name === 'device_ids');

    if (hasOldColumn && !hasNewColumn) {
      logger.info('Migrating schedules table: device_id -> device_ids');
      sqlite.exec(`
        ALTER TABLE schedules RENAME COLUMN device_id TO device_ids;
      `);
      // Convert existing single device_id values to JSON arrays
      const schedules = sqlite.prepare("SELECT id, device_ids FROM schedules").all() as Array<{ id: string; device_ids: string }>;
      for (const schedule of schedules) {
        // If it's not already a JSON array, wrap it
        if (!schedule.device_ids.startsWith('[')) {
          sqlite.prepare("UPDATE schedules SET device_ids = ? WHERE id = ?").run(
            JSON.stringify([schedule.device_ids]),
            schedule.id
          );
        }
      }
      logger.info('Migration completed: device_id -> device_ids');
    }
  } catch (error) {
    // Table might not exist yet or migration already done
    logger.debug({ error }, 'Migration check skipped');
  }

  // Migration: Add user_id column to devices table
  try {
    const devicesTableInfo = sqlite.prepare("PRAGMA table_info(devices)").all() as Array<{ name: string }>;
    const devicesHasUserId = devicesTableInfo.some(col => col.name === 'user_id');

    if (!devicesHasUserId && devicesTableInfo.length > 0) {
      logger.info('Migrating devices table: adding user_id column');
      // SQLite doesn't support ADD COLUMN with NOT NULL without default on existing tables with rows
      // So we add without NOT NULL constraint, update existing rows, then the schema is applied on new inserts
      sqlite.exec(`ALTER TABLE devices ADD COLUMN user_id TEXT DEFAULT 'legacy';`);
      sqlite.exec(`UPDATE devices SET user_id = 'legacy' WHERE user_id IS NULL;`);
      logger.info('Migration completed: devices.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Devices user_id migration check skipped');
  }

  // Migration: Add user_id column to schedules table
  try {
    const schedulesTableInfo = sqlite.prepare("PRAGMA table_info(schedules)").all() as Array<{ name: string }>;
    const schedulesHasUserId = schedulesTableInfo.some(col => col.name === 'user_id');

    if (!schedulesHasUserId && schedulesTableInfo.length > 0) {
      logger.info('Migrating schedules table: adding user_id column');
      sqlite.exec(`ALTER TABLE schedules ADD COLUMN user_id TEXT DEFAULT 'legacy';`);
      sqlite.exec(`UPDATE schedules SET user_id = 'legacy' WHERE user_id IS NULL;`);
      logger.info('Migration completed: schedules.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Schedules user_id migration check skipped');
  }

  // Migration: Migrate settings table to new schema with user_id
  try {
    const settingsTableInfo = sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;
    const settingsHasUserId = settingsTableInfo.some(col => col.name === 'user_id');
    const settingsHasId = settingsTableInfo.some(col => col.name === 'id');

    if (!settingsHasUserId && settingsTableInfo.length > 0 && !settingsHasId) {
      logger.info('Migrating settings table: adding user_id column');
      // Backup old settings
      const oldSettings = sqlite.prepare("SELECT key, value, updated_at FROM settings").all() as Array<{ key: string; value: string; updated_at: string }>;

      // Drop old table and create new one
      sqlite.exec(`DROP TABLE settings;`);
      sqlite.exec(`
        CREATE TABLE settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, key)
        );
        CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);
      `);

      // Restore old settings with 'legacy' user
      for (const setting of oldSettings) {
        sqlite.prepare("INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)").run(
          'legacy',
          setting.key,
          setting.value,
          setting.updated_at
        );
      }
      logger.info('Migration completed: settings table restructured');
    }
  } catch (error) {
    logger.debug({ error }, 'Settings migration check skipped');
  }

  logger.info('Database migrations completed');
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    logger.info('Database connection closed');
  }
}

export { schema };
