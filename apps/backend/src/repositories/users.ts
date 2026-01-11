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
export async function findByGoogleId(googleId: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleId, googleId));

  if (rows.length === 0) return null;

  const row = rows[0];
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
export async function findById(id: string): Promise<User | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id));

  if (rows.length === 0) return null;

  const row = rows[0];
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
export async function upsertFromGoogle(userInfo: GoogleUserInfo): Promise<User> {
  const db = getDb();
  const existing = await findByGoogleId(userInfo.googleId);
  const now = new Date().toISOString();

  if (existing) {
    // Update existing user
    await db.update(schema.users)
      .set({
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture || null,
        lastLoginAt: now,
      })
      .where(eq(schema.users.googleId, userInfo.googleId));

    const updated = await findByGoogleId(userInfo.googleId);
    return updated!;
  }

  // Create new user
  const id = uuidv4();
  await db.insert(schema.users)
    .values({
      id,
      googleId: userInfo.googleId,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture || null,
      createdAt: now,
      lastLoginAt: now,
    });

  const created = await findById(id);
  return created!;
}

/**
 * Migrate legacy data to a user
 * Updates all devices, schedules, and settings that have 'legacy' as user_id
 */
export async function migrateLegacyDataToUser(userId: string): Promise<void> {
  const db = getDb();

  // Migrate devices
  await db.update(schema.devices)
    .set({ userId })
    .where(eq(schema.devices.userId, 'legacy'));

  // Migrate schedules
  await db.update(schema.schedules)
    .set({ userId })
    .where(eq(schema.schedules.userId, 'legacy'));

  // Migrate settings
  await db.update(schema.settings)
    .set({ userId })
    .where(eq(schema.settings.userId, 'legacy'));
}
