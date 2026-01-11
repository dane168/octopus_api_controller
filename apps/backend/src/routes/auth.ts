import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { config } from '../config/index.js';
import { upsertFromGoogle, migrateLegacyDataToUser, findById } from '../repositories/users.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export const authRoutes = Router();

// Google OAuth client - only for verifying tokens, not for redirect flow
const googleClient = config.GOOGLE_CLIENT_ID
  ? new OAuth2Client(config.GOOGLE_CLIENT_ID)
  : null;

const googleLoginSchema = z.object({
  credential: z.string().min(1),
});

/**
 * POST /api/auth/google
 * Exchange Google ID token for our JWT
 */
authRoutes.post('/google', async (req: Request, res: Response) => {
  try {
    if (!googleClient || !config.GOOGLE_CLIENT_ID) {
      return res.status(501).json({ error: 'Google OAuth not configured' });
    }

    const validation = googleLoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { credential } = validation.data;

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    // Create or update user
    const user = await upsertFromGoogle({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
    });

    // Migrate any legacy data to this user (first user to log in gets it)
    await migrateLegacyDataToUser(user.id);

    // Generate our JWT
    const token = generateToken(user);

    logger.info({ userId: user.id, email: user.email }, 'User logged in via Google');

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Google login failed');
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
authRoutes.get('/me', requireAuth, (req: Request, res: Response) => {
  // User is guaranteed to exist after requireAuth middleware
  const user = req.user as { id: string; email: string; name: string; picture?: string };

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  });
});

/**
 * POST /api/auth/logout
 * Logout endpoint (mainly for client-side state management)
 */
authRoutes.post('/logout', (req: Request, res: Response) => {
  // JWT is stateless, so we just return success
  // Client should remove the token
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/config
 * Get auth configuration (public endpoint)
 */
authRoutes.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleClientId: config.GOOGLE_CLIENT_ID || null,
    authEnabled: !!config.GOOGLE_CLIENT_ID,
  });
});
