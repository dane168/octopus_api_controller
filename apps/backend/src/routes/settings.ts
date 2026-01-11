import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OCTOPUS_REGIONS, isValidRegion } from '@octopus-controller/shared';
import * as settingsRepo from '../repositories/settings.js';
import { AppError } from '../middleware/error.js';
import { optionalAuth } from '../middleware/auth.js';

export const settingsRoutes = Router();

// Apply optional auth to all routes
settingsRoutes.use(optionalAuth);

const updateSettingsSchema = z.object({
  region: z.string().optional(),
  octopusApiKey: z.string().min(1, 'API Key is required'),
  octopusMpan: z.string().optional(),
  octopusSerial: z.string().optional(),
});

/**
 * GET /api/settings
 * Get all settings for the current user
 */
settingsRoutes.get('/', (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const settings = settingsRepo.getSettings(userId);

  // Mask API key if present (show correct number of stars)
  if (settings.octopusApiKey && settings.octopusApiKey.length > 4) {
    const len = settings.octopusApiKey.length;
    settings.octopusApiKey = '*'.repeat(len - 4) + settings.octopusApiKey.slice(-4);
  } else if (settings.octopusApiKey) {
    settings.octopusApiKey = settings.octopusApiKey;
  }

  res.json({ settings });
});

/**
 * GET /api/settings/regions
 * Get available regions
 */
settingsRoutes.get('/regions', (_req, res) => {
  const regions = Object.entries(OCTOPUS_REGIONS).map(([code, name]) => ({
    code,
    name,
  }));

  res.json({ regions });
});

/**
 * PUT /api/settings
 * Update settings for the current user
 */
settingsRoutes.put('/', (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const updates = updateSettingsSchema.partial().parse(req.body);

    // Validate region if provided
    if (updates.region && !isValidRegion(updates.region)) {
      throw new AppError(400, `Invalid region code: ${updates.region}. Valid codes are A-P.`);
    }

    // If API key is not provided in update, keep existing
    if (!('octopusApiKey' in updates) || updates.octopusApiKey === undefined) {
      const current = settingsRepo.getSetting('octopusApiKey', userId);
      if (!current) {
        throw new AppError(400, 'Octopus API Key is required.');
      }
      // Don't update key
      delete updates.octopusApiKey;
    } else if (!updates.octopusApiKey) {
      // If explicitly set to blank, treat as error
      throw new AppError(400, 'Octopus API Key is required.');
    }

    // Always store the full key in DB (do not mask)
    settingsRepo.updateSettings(updates, userId);
    const settings = settingsRepo.getSettings(userId);

    // Mask API key in response only
    if (settings.octopusApiKey) {
      settings.octopusApiKey = '***' + settings.octopusApiKey.slice(-4);
    }

    res.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (error) {
    next(error);
  }
});
