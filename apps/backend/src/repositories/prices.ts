import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import type { Price } from '@octopus-controller/shared';
import { logger } from '../utils/logger.js';

/**
 * Upsert prices (insert or update on conflict)
 */
export async function upsertPrices(pricesToInsert: Price[]): Promise<number> {
  const db = getDb();
  let inserted = 0;

  for (const price of pricesToInsert) {
    try {
      // Check if price exists
      const existing = db
        .select()
        .from(schema.prices)
        .where(
          and(
            eq(schema.prices.validFrom, price.validFrom),
            eq(schema.prices.region, price.region)
          )
        )
        .get();

      if (existing) {
        // Update existing
        db.update(schema.prices)
          .set({
            validTo: price.validTo,
            valueIncVat: price.valueIncVat,
            valueExcVat: price.valueExcVat,
          })
          .where(eq(schema.prices.id, existing.id))
          .run();
      } else {
        // Insert new
        db.insert(schema.prices)
          .values({
            validFrom: price.validFrom,
            validTo: price.validTo,
            valueIncVat: price.valueIncVat,
            valueExcVat: price.valueExcVat,
            region: price.region,
          })
          .run();
        inserted++;
      }
    } catch (error) {
      logger.error({ error, price }, 'Failed to upsert price');
    }
  }

  return inserted;
}

/**
 * Get prices within a time range
 */
export function getPrices(options: {
  from?: string;
  to?: string;
  region?: string;
}): Price[] {
  const db = getDb();
  const { from, to, region } = options;

  let query = db.select().from(schema.prices);

  const conditions = [];
  if (from) {
    conditions.push(gte(schema.prices.validFrom, from));
  }
  if (to) {
    conditions.push(lte(schema.prices.validFrom, to));
  }
  if (region) {
    conditions.push(eq(schema.prices.region, region));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = query.orderBy(asc(schema.prices.validFrom)).all();

  return results.map((row) => ({
    id: row.id,
    validFrom: row.validFrom,
    validTo: row.validTo,
    valueIncVat: row.valueIncVat,
    valueExcVat: row.valueExcVat,
    region: row.region,
  }));
}

/**
 * Get current price (price valid at current time)
 */
export function getCurrentPrice(region?: string): Price | null {
  const db = getDb();
  const now = new Date().toISOString();

  const conditions = [
    lte(schema.prices.validFrom, now),
    gte(schema.prices.validTo, now),
  ];

  if (region) {
    conditions.push(eq(schema.prices.region, region));
  }

  const result = db
    .select()
    .from(schema.prices)
    .where(and(...conditions))
    .orderBy(desc(schema.prices.validFrom))
    .limit(1)
    .get();

  if (!result) return null;

  return {
    id: result.id,
    validFrom: result.validFrom,
    validTo: result.validTo,
    valueIncVat: result.valueIncVat,
    valueExcVat: result.valueExcVat,
    region: result.region,
  };
}

/**
 * Get cheapest hours within a time window
 */
export function getCheapestHours(options: {
  hours: number;
  from?: string;
  to?: string;
  region?: string;
  consecutive?: boolean;
}): Price[] {
  const { hours, from, to, region, consecutive = false } = options;

  // Get all prices in the window
  const allPrices = getPrices({ from, to, region });

  if (allPrices.length === 0) return [];

  // Number of 30-minute slots needed
  const slotsNeeded = Math.ceil(hours * 2);

  if (consecutive) {
    // Find the consecutive window with lowest average price
    let bestStart = 0;
    let bestSum = Infinity;

    for (let i = 0; i <= allPrices.length - slotsNeeded; i++) {
      const windowSum = allPrices
        .slice(i, i + slotsNeeded)
        .reduce((sum, p) => sum + p.valueIncVat, 0);

      if (windowSum < bestSum) {
        bestSum = windowSum;
        bestStart = i;
      }
    }

    return allPrices.slice(bestStart, bestStart + slotsNeeded);
  } else {
    // Just get the N cheapest slots
    return [...allPrices]
      .sort((a, b) => a.valueIncVat - b.valueIncVat)
      .slice(0, slotsNeeded)
      .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());
  }
}

/**
 * Get today's prices
 */
export function getTodayPrices(region?: string): Price[] {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return getPrices({
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString(),
    region,
  });
}

/**
 * Delete old prices (older than specified days)
 */
export function deleteOldPrices(daysOld: number = 7): number {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = db
    .delete(schema.prices)
    .where(lte(schema.prices.validTo, cutoff.toISOString()))
    .run();

  return result.changes;
}
