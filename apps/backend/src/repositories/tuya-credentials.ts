import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import type { TuyaCredentials, TuyaCredentialsInput } from '@octopus-controller/shared';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Simple encryption/decryption for access secrets
 * NOTE: In production, use a proper encryption library like crypto.scrypt
 * with a strong key stored in environment variables
 */
function encryptSecret(secret: string): string {
  // TODO: Implement proper encryption
  // For now, just Base64 encode (NOT SECURE - replace with proper encryption)
  return Buffer.from(secret).toString('base64');
}

function decryptSecret(encrypted: string): string {
  // TODO: Implement proper decryption
  // For now, just Base64 decode
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

/**
 * Get Tuya credentials for a user
 */
export async function getTuyaCredentials(userId: string): Promise<TuyaCredentials | null> {
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(schema.tuyaCredentials)
      .where(eq(schema.tuyaCredentials.userId, userId));

    if (result.length === 0) {
      return null;
    }

    const creds = result[0];

    return {
      id: creds.id,
      userId: creds.userId,
      accessId: creds.accessId,
      accessSecret: decryptSecret(creds.accessSecret),
      endpoint: creds.endpoint,
      uid: creds.uid || undefined,
      createdAt: creds.createdAt || undefined,
      updatedAt: creds.updatedAt || undefined,
    };
  } catch (error) {
    logger.error({ error, userId }, 'Error getting Tuya credentials');
    throw error;
  }
}

/**
 * Create or update Tuya credentials for a user
 */
export async function upsertTuyaCredentials(
  userId: string,
  input: TuyaCredentialsInput
): Promise<TuyaCredentials> {
  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(schema.tuyaCredentials)
      .where(eq(schema.tuyaCredentials.userId, userId));

    const encryptedSecret = encryptSecret(input.accessSecret);
    const endpoint = input.endpoint || 'https://openapi.tuyaeu.com';
    const now = new Date().toISOString();

    if (existing.length > 0) {
      // Update existing credentials
      await db.update(schema.tuyaCredentials)
        .set({
          accessId: input.accessId,
          accessSecret: encryptedSecret,
          endpoint,
          updatedAt: now,
        })
        .where(eq(schema.tuyaCredentials.userId, userId));

      logger.info({ userId }, 'Updated Tuya credentials');

      return {
        id: existing[0].id,
        userId,
        accessId: input.accessId,
        accessSecret: input.accessSecret, // Return decrypted
        endpoint,
        createdAt: existing[0].createdAt || undefined,
        updatedAt: now,
      };
    } else {
      // Insert new credentials
      const id = randomUUID();
      await db.insert(schema.tuyaCredentials)
        .values({
          id,
          userId,
          accessId: input.accessId,
          accessSecret: encryptedSecret,
          endpoint,
          createdAt: now,
          updatedAt: now,
        });

      logger.info({ userId }, 'Created Tuya credentials');

      return {
        id,
        userId,
        accessId: input.accessId,
        accessSecret: input.accessSecret, // Return decrypted
        endpoint,
        createdAt: now,
        updatedAt: now,
      };
    }
  } catch (error) {
    logger.error({ error, userId }, 'Error upserting Tuya credentials');
    throw error;
  }
}

/**
 * Delete Tuya credentials for a user
 */
export async function deleteTuyaCredentials(userId: string): Promise<void> {
  try {
    const db = getDb();
    await db.delete(schema.tuyaCredentials)
      .where(eq(schema.tuyaCredentials.userId, userId));
    logger.info({ userId }, 'Deleted Tuya credentials');
  } catch (error) {
    logger.error({ error, userId }, 'Error deleting Tuya credentials');
    throw error;
  }
}

/**
 * Check if user has Tuya credentials configured
 */
export async function hasTuyaCredentials(userId: string): Promise<boolean> {
  try {
    const db = getDb();
    const result = await db
      .select({ id: schema.tuyaCredentials.id })
      .from(schema.tuyaCredentials)
      .where(eq(schema.tuyaCredentials.userId, userId));

    return result.length > 0;
  } catch (error) {
    logger.error({ error, userId }, 'Error checking Tuya credentials');
    return false;
  }
}
