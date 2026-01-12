import { priceFetchJob, priceRefreshJob } from './price-fetch.js';
import { scheduleExecutorJob } from './schedule-executor.js';
import { dbCleanupJob } from './db-cleanup.js';
import { logger } from '../utils/logger.js';

/**
 * Start all scheduled jobs
 */
export function startJobs() {
  // Start price fetch job (16:05 daily)
  priceFetchJob.start();
  logger.info('Price fetch job scheduled (16:05 daily UK time)');

  // Start price refresh job (every 6 hours)
  priceRefreshJob.start();
  logger.info('Price refresh job scheduled (every 6 hours)');

  // Start schedule executor (every minute)
  scheduleExecutorJob.start();
  logger.info('Schedule executor started (runs every minute)');

  // Start database cleanup job (3:00 AM daily)
  dbCleanupJob.start();
  logger.info('Database cleanup job scheduled (3:00 AM daily)');
}

/**
 * Stop all scheduled jobs
 */
export function stopJobs() {
  priceFetchJob.stop();
  priceRefreshJob.stop();
  scheduleExecutorJob.stop();
  dbCleanupJob.stop();
  logger.info('All jobs stopped');
}
