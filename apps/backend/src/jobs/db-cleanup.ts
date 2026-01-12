import cron from 'node-cron';
import { lte } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Database cleanup job
 * Runs daily at 3:00 AM to keep database size small
 */
export const dbCleanupJob = cron.schedule(
  '0 3 * * *', // 3:00 AM daily
  async () => {
    logger.info('Running database cleanup');

    try {
      const db = getDb();
      const now = new Date();

      // Keep only 7 days of prices (energy prices older than that aren't useful)
      const pricesCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oldPrices = await db
        .select()
        .from(schema.prices)
        .where(lte(schema.prices.validTo, pricesCutoff));

      if (oldPrices.length > 0) {
        await db.delete(schema.prices).where(lte(schema.prices.validTo, pricesCutoff));
        logger.info({ deleted: oldPrices.length }, 'Deleted old price records');
      }

      // Keep only 30 days of schedule logs
      const logsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const oldLogs = await db
        .select()
        .from(schema.scheduleLogs)
        .where(lte(schema.scheduleLogs.executedAt, logsCutoff));

      if (oldLogs.length > 0) {
        await db.delete(schema.scheduleLogs).where(lte(schema.scheduleLogs.executedAt, logsCutoff));
        logger.info({ deleted: oldLogs.length }, 'Deleted old schedule logs');
      }

      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Database cleanup failed');
    }
  },
  {
    timezone: 'Europe/London',
    scheduled: false,
  }
);
