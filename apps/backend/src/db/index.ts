import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

let sqlite: Database.Database;
let db: BetterSQLite3Database<typeof schema>;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase() {
  // Ensure data directory exists
  const dbDir = path.dirname(config.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info(`Using local SQLite database: ${config.DATABASE_PATH}`);
  sqlite = new Database(config.DATABASE_PATH);

  // Enable WAL mode for better concurrent access
  sqlite.pragma('journal_mode = WAL');

  // Initialize Drizzle
  db = drizzle(sqlite, { schema });

  // Run migrations (create tables if they don't exist)
  runMigrations();

  logger.info(`Database initialized at: ${config.DATABASE_PATH}`);
}

function runMigrations() {
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

    CREATE TABLE IF NOT EXISTS tuya_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_id TEXT NOT NULL,
      access_secret TEXT NOT NULL,
      endpoint TEXT NOT NULL DEFAULT 'https://openapi.tuyaeu.com',
      uid TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run data migrations
  runDataMigrations();

  logger.info('Database migrations completed');
}

function runDataMigrations() {
  // Migration: Check and add user_id to devices if missing
  try {
    const devicesInfo = sqlite.prepare("PRAGMA table_info(devices)").all() as any[];
    const devicesHasUserId = devicesInfo.some((row) => row.name === 'user_id');

    if (!devicesHasUserId && devicesInfo.length > 0) {
      logger.info('Migrating devices table: adding user_id column');
      sqlite.exec("ALTER TABLE devices ADD COLUMN user_id TEXT DEFAULT 'legacy'");
      sqlite.exec("UPDATE devices SET user_id = 'legacy' WHERE user_id IS NULL");
      logger.info('Migration completed: devices.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Devices user_id migration check skipped');
  }

  // Migration: Check and add user_id to schedules if missing
  try {
    const schedulesInfo = sqlite.prepare("PRAGMA table_info(schedules)").all() as any[];
    const schedulesHasUserId = schedulesInfo.some((row) => row.name === 'user_id');

    if (!schedulesHasUserId && schedulesInfo.length > 0) {
      logger.info('Migrating schedules table: adding user_id column');
      sqlite.exec("ALTER TABLE schedules ADD COLUMN user_id TEXT DEFAULT 'legacy'");
      sqlite.exec("UPDATE schedules SET user_id = 'legacy' WHERE user_id IS NULL");
      logger.info('Migration completed: schedules.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Schedules user_id migration check skipped');
  }

  // Migration: Rename device_id to device_ids if needed
  try {
    const schedulesInfo = sqlite.prepare("PRAGMA table_info(schedules)").all() as any[];
    const hasOldColumn = schedulesInfo.some((row) => row.name === 'device_id');
    const hasNewColumn = schedulesInfo.some((row) => row.name === 'device_ids');

    if (hasOldColumn && !hasNewColumn) {
      logger.info('Migrating schedules table: device_id -> device_ids');
      sqlite.exec("ALTER TABLE schedules RENAME COLUMN device_id TO device_ids");

      // Convert existing single device_id values to JSON arrays
      const schedules = sqlite.prepare("SELECT id, device_ids FROM schedules").all() as any[];
      const updateStmt = sqlite.prepare("UPDATE schedules SET device_ids = ? WHERE id = ?");
      for (const schedule of schedules) {
        const deviceIds = schedule.device_ids as string;
        if (deviceIds && !deviceIds.startsWith('[')) {
          updateStmt.run(JSON.stringify([deviceIds]), schedule.id);
        }
      }
      logger.info('Migration completed: device_id -> device_ids');
    }
  } catch (error) {
    logger.debug({ error }, 'device_id migration check skipped');
  }
}

export async function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    logger.info('Database connection closed');
  }
}

export { schema };
