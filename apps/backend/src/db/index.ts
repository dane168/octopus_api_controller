import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let client: Client;
let db: LibSQLDatabase<typeof schema>;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase() {
  // Use Turso if URL is provided, otherwise use local file
  const isTurso = !!config.TURSO_DATABASE_URL;

  if (isTurso) {
    logger.info('Connecting to Turso database...');
    client = createClient({
      url: config.TURSO_DATABASE_URL!,
      authToken: config.TURSO_AUTH_TOKEN,
    });
  } else {
    logger.info(`Using local SQLite database: ${config.DATABASE_PATH}`);
    client = createClient({
      url: `file:${config.DATABASE_PATH}`,
    });
  }

  // Initialize Drizzle
  db = drizzle(client, { schema });

  // Run migrations (create tables if they don't exist)
  await runMigrations();

  logger.info(isTurso ? 'Connected to Turso database' : `Database initialized at: ${config.DATABASE_PATH}`);
}

async function runMigrations() {
  // Create tables if they don't exist
  await client.executeMultiple(`
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
  await runDataMigrations();

  logger.info('Database migrations completed');
}

async function runDataMigrations() {
  // Migration: Check and add user_id to devices if missing
  try {
    const devicesInfo = await client.execute("PRAGMA table_info(devices)");
    const devicesHasUserId = devicesInfo.rows.some((row: any) => row.name === 'user_id');

    if (!devicesHasUserId && devicesInfo.rows.length > 0) {
      logger.info('Migrating devices table: adding user_id column');
      await client.execute("ALTER TABLE devices ADD COLUMN user_id TEXT DEFAULT 'legacy'");
      await client.execute("UPDATE devices SET user_id = 'legacy' WHERE user_id IS NULL");
      logger.info('Migration completed: devices.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Devices user_id migration check skipped');
  }

  // Migration: Check and add user_id to schedules if missing
  try {
    const schedulesInfo = await client.execute("PRAGMA table_info(schedules)");
    const schedulesHasUserId = schedulesInfo.rows.some((row: any) => row.name === 'user_id');

    if (!schedulesHasUserId && schedulesInfo.rows.length > 0) {
      logger.info('Migrating schedules table: adding user_id column');
      await client.execute("ALTER TABLE schedules ADD COLUMN user_id TEXT DEFAULT 'legacy'");
      await client.execute("UPDATE schedules SET user_id = 'legacy' WHERE user_id IS NULL");
      logger.info('Migration completed: schedules.user_id added');
    }
  } catch (error) {
    logger.debug({ error }, 'Schedules user_id migration check skipped');
  }

  // Migration: Rename device_id to device_ids if needed
  try {
    const schedulesInfo = await client.execute("PRAGMA table_info(schedules)");
    const hasOldColumn = schedulesInfo.rows.some((row: any) => row.name === 'device_id');
    const hasNewColumn = schedulesInfo.rows.some((row: any) => row.name === 'device_ids');

    if (hasOldColumn && !hasNewColumn) {
      logger.info('Migrating schedules table: device_id -> device_ids');
      await client.execute("ALTER TABLE schedules RENAME COLUMN device_id TO device_ids");

      // Convert existing single device_id values to JSON arrays
      const schedules = await client.execute("SELECT id, device_ids FROM schedules");
      for (const schedule of schedules.rows) {
        const deviceIds = schedule.device_ids as string;
        if (deviceIds && !deviceIds.startsWith('[')) {
          await client.execute({
            sql: "UPDATE schedules SET device_ids = ? WHERE id = ?",
            args: [JSON.stringify([deviceIds]), schedule.id as string]
          });
        }
      }
      logger.info('Migration completed: device_id -> device_ids');
    }
  } catch (error) {
    logger.debug({ error }, 'device_id migration check skipped');
  }
}

export async function closeDatabase() {
  if (client) {
    client.close();
    logger.info('Database connection closed');
  }
}

export { schema };
