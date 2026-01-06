import cron from 'node-cron';
import * as octopus from '../services/octopus/index.js';
import * as priceRepo from '../repositories/prices.js';
import { getSettings } from '../repositories/settings.js';
import { logger } from '../utils/logger.js';

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
      const settings = getSettings();

      if (!settings.region) {
        logger.warn('Region not configured, skipping price fetch');
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
      });

      const inserted = await priceRepo.upsertPrices(prices);

      logger.info({
        count: prices.length,
        inserted,
        region: settings.region,
      }, 'Scheduled price fetch completed');

      // Clean up old prices (older than 7 days)
      const deleted = priceRepo.deleteOldPrices(7);
      if (deleted > 0) {
        logger.info({ deleted }, 'Cleaned up old prices');
      }
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
      const settings = getSettings();

      if (!settings.region) {
        logger.debug('Region not configured, skipping price refresh');
        return;
      }

      // Fetch next 48 hours
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 2);

      const prices = await octopus.fetchAgileprices({
        region: settings.region,
        periodFrom: now.toISOString(),
        periodTo: futureDate.toISOString(),
      });

      const inserted = await priceRepo.upsertPrices(prices);

      logger.info({
        count: prices.length,
        inserted,
        region: settings.region,
      }, 'Periodic price refresh completed');
    } catch (error) {
      logger.error({ error }, 'Periodic price refresh failed');
    }
  },
  {
    timezone: 'Europe/London',
    scheduled: false,
  }
);
