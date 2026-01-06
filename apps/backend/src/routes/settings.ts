import { Router } from 'express';
import { z } from 'zod';
import { OCTOPUS_REGIONS, isValidRegion } from '@octopus-controller/shared';
import * as settingsRepo from '../repositories/settings.js';
import { AppError } from '../middleware/error.js';

export const settingsRoutes = Router();

const updateSettingsSchema = z.object({
  region: z.string().optional(),
  octopusApiKey: z.string().optional(),
  octopusMpan: z.string().optional(),
  octopusSerial: z.string().optional(),
});

/**
 * GET /api/settings
 * Get all settings
 */
settingsRoutes.get('/', (_req, res) => {
  const settings = settingsRepo.getSettings();

  // Mask API key if present
  if (settings.octopusApiKey) {
    settings.octopusApiKey = '***' + settings.octopusApiKey.slice(-4);
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
 * Update settings
 */
settingsRoutes.put('/', (req, res, next) => {
  try {
    const updates = updateSettingsSchema.parse(req.body);

    // Validate region if provided
    if (updates.region && !isValidRegion(updates.region)) {
      throw new AppError(400, `Invalid region code: ${updates.region}. Valid codes are A-P.`);
    }

    settingsRepo.updateSettings(updates);
    const settings = settingsRepo.getSettings();

    // Mask API key if present
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
