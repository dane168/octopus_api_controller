import cron from 'node-cron';
import * as octopus from '../services/octopus/index.js';
import * as priceRepo from '../repositories/prices.js';
import { getSettings, getUserIdsWithRegion } from '../repositories/settings.js';
import { logger } from '../utils/logger.js';

/**
 * Fetch and store prices for a single user
 */
async function fetchPricesForUser(userId: string): Promise<void> {
  try {
    const settings = await getSettings(userId);

    if (!settings.region) {
      logger.debug({ userId }, 'Region not configured for user, skipping price fetch');
      return;
    }

    // Fetch next 48 hours of prices to ensure we have tomorrow covered
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 2);

    const prices = await octopus.fetchAgileprices({
      region: settings.region,
      periodFrom: now.toISOString(),
      periodTo: futureDate.toISOString(),
      userId,
    });

    const inserted = await priceRepo.upsertPrices(prices);

    logger.info({
      count: prices.length,
      inserted,
      region: settings.region,
      userId,
    }, 'Price fetch completed for user');
  } catch (error) {
    logger.error({ error, userId }, 'Price fetch failed for user');
  }
}

/**
 * Price fetch job
 * Runs at 16:05 daily (UK time) to fetch the next day's prices
 * Octopus releases prices at ~16:00 for the period 23:00-23:00
 */
export const priceFetchJob = cron.schedule(
  '5 16 * * *', // 16:05 every day
  async () => {
    logger.info('Starting scheduled price fetch');

    try {
      // Get all users with configured regions
      const userIds = await getUserIdsWithRegion();

      if (userIds.length === 0) {
        logger.warn('No users with configured regions, skipping price fetch');
        return;
      }

      logger.info({ userCount: userIds.length }, 'Fetching prices for users');

      // Fetch prices for each user
      for (const userId of userIds) {
        await fetchPricesForUser(userId);
      }

      // Clean up old prices (older than 7 days)
      const deleted = await priceRepo.deleteOldPrices(7);
      if (deleted > 0) {
        logger.info({ deleted }, 'Cleaned up old prices');
      }

      logger.info('Scheduled price fetch completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled price fetch failed');
    }
  },
  {
    timezone: 'Europe/London',
    scheduled: false, // Don't start automatically
  }
);

/**
 * Also run every 6 hours to keep prices up to date
 * This catches any missed updates or manual refreshes
 */
export const priceRefreshJob = cron.schedule(
  '0 */6 * * *', // Every 6 hours
  async () => {
    logger.info('Starting periodic price refresh');

    try {
      // Get all users with configured regions
      const userIds = await getUserIdsWithRegion();

      if (userIds.length === 0) {
        logger.debug('No users with configured regions, skipping price refresh');
        return;
      }

      // Fetch prices for each user
      for (const userId of userIds) {
        await fetchPricesForUser(userId);
      }

      logger.info('Periodic price refresh completed');
    } catch (error) {
      logger.error({ error }, 'Periodic price refresh failed');
    }
  },
  {
    timezone: 'Europe/London',
    scheduled: false,
  }
);
