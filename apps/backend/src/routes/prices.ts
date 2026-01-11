import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as priceRepo from '../repositories/prices.js';
import * as octopus from '../services/octopus/index.js';
import { getSettings } from '../repositories/settings.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';

export const priceRoutes = Router();

// Apply optional auth to all price routes
priceRoutes.use(optionalAuth);

// Query validation schemas
const priceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  region: z.string().optional(),
});

const cheapestQuerySchema = z.object({
  hours: z.string().transform(Number),
  from: z.string().optional(),
  to: z.string().optional(),
  consecutive: z.string().optional().transform((v) => v === 'true'),
});

/**
 * GET /api/prices
 * Get prices within a time range
 */
priceRoutes.get('/', (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const query = priceQuerySchema.parse(req.query);
    const region = query.region || getSettings(userId).region;

    const prices = priceRepo.getPrices({
      from: query.from,
      to: query.to,
      region,
    });

    res.json({ prices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prices/current
 * Get the current price
 */
priceRoutes.get('/current', (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const region = (req.query.region as string) || getSettings(userId).region;
    const price = priceRepo.getCurrentPrice(region);

    if (!price) {
      throw new AppError(404, 'No current price found. Try refreshing prices.');
    }

    res.json({ price });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prices/today
 * Get today's prices
 */
priceRoutes.get('/today', (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const region = (req.query.region as string) || getSettings(userId).region;
    const prices = priceRepo.getTodayPrices(region);

    res.json({ prices });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prices/cheapest
 * Get the cheapest hours within a time window
 */
priceRoutes.get('/cheapest', (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const query = cheapestQuerySchema.parse(req.query);
    const region = (req.query.region as string) || getSettings(userId).region;

    if (query.hours <= 0 || query.hours > 24) {
      throw new AppError(400, 'Hours must be between 0 and 24');
    }

    const prices = priceRepo.getCheapestHours({
      hours: query.hours,
      from: query.from,
      to: query.to,
      region,
      consecutive: query.consecutive,
    });

    res.json({ prices });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prices/refresh
 * Manually trigger a price fetch from Octopus API
 */
priceRoutes.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const region = getSettings(userId).region;

    if (!region) {
      throw new AppError(400, 'Region not configured. Please set your region in Settings.');
    }

    logger.info({ region }, 'Manual price refresh triggered');

    // Fetch next 48 hours of prices
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 2);

    const prices = await octopus.fetchAgileprices({
      region,
      periodFrom: now.toISOString(),
      periodTo: futureDate.toISOString(),
      userId,
    });

    const inserted = await priceRepo.upsertPrices(prices);

    res.json({
      message: 'Prices refreshed successfully',
      count: prices.length,
      inserted,
    });
  } catch (error) {
    next(error);
  }
});
