import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Find user by Google ID
 */
export function findByGoogleId(googleId: string): User | null {
  const db = getDb();
  const row = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleId, googleId))
    .get();

  if (!row) return null;

  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    picture: row.picture || undefined,
    createdAt: row.createdAt || undefined,
    lastLoginAt: row.lastLoginAt || undefined,
  };
}

/**
 * Find user by ID
 */
export function findById(id: string): User | null {
  const db = getDb();
  const row = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!row) return null;

  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    picture: row.picture || undefined,
    createdAt: row.createdAt || undefined,
    lastLoginAt: row.lastLoginAt || undefined,
  };
}

/**
 * Create or update user from Google OAuth
 */
export function upsertFromGoogle(userInfo: GoogleUserInfo): User {
  const db = getDb();
  const existing = findByGoogleId(userInfo.googleId);
  const now = new Date().toISOString();

  if (existing) {
    // Update existing user
    db.update(schema.users)
      .set({
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture || null,
        lastLoginAt: now,
      })
      .where(eq(schema.users.googleId, userInfo.googleId))
      .run();

    return findByGoogleId(userInfo.googleId)!;
  }

  // Create new user
  const id = uuidv4();
  db.insert(schema.users)
    .values({
      id,
      googleId: userInfo.googleId,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture || null,
      createdAt: now,
      lastLoginAt: now,
    })
    .run();

  return findById(id)!;
}

/**
 * Migrate legacy data to a user
 * Updates all devices, schedules, and settings that have 'legacy' as user_id
 */
export function migrateLegacyDataToUser(userId: string): void {
  const db = getDb();

  // Migrate devices
  db.update(schema.devices)
    .set({ userId })
    .where(eq(schema.devices.userId, 'legacy'))
    .run();

  // Migrate schedules
  db.update(schema.schedules)
    .set({ userId })
    .where(eq(schema.schedules.userId, 'legacy'))
    .run();

  // Migrate settings
  db.update(schema.settings)
    .set({ userId })
    .where(eq(schema.settings.userId, 'legacy'))
    .run();
}
