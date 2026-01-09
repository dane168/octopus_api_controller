import axios, { type AxiosResponse } from 'axios';
import type { OctopusUnitRatesResponse, OctopusUnitRate, Price } from '@octopus-controller/shared';
import { logger } from '../../utils/logger.js';
import { getSettings } from '../../repositories/settings.js';

const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1';

// Current Agile tariff product code
const AGILE_PRODUCT_CODE = 'AGILE-24-10-01';

export interface FetchPricesOptions {
  region: string;
  periodFrom?: string;
  periodTo?: string;
}

/**
 * Get the tariff code for a region
 */
function getTariffCode(region: string): string {
  return `E-1R-${AGILE_PRODUCT_CODE}-${region}`;
}

/**
 * Fetch Agile prices from Octopus Energy API
 */
export async function fetchAgileprices(options: FetchPricesOptions): Promise<Price[]> {
  const { region, periodFrom, periodTo } = options;
  const tariffCode = getTariffCode(region);
  const url = `${OCTOPUS_API_BASE}/products/${AGILE_PRODUCT_CODE}/electricity-tariffs/${tariffCode}/standard-unit-rates/`;
  const params: Record<string, string> = {};
  if (periodFrom) params.period_from = periodFrom;
  if (periodTo) params.period_to = periodTo;

  // Get API key from DB settings
  const settings = getSettings();
  const apiKey = settings.octopusApiKey;
  if (!apiKey) {
    logger.error({ region }, 'Octopus API Key is required but missing in settings');
    throw new Error('Octopus API Key is required in settings');
  }

  logger.info({ url, params, region }, 'Fetching Octopus prices (entry)');

  try {
    const allPrices: Price[] = [];
    let nextUrl: string | null = url;
    let page = 1;

    // Handle pagination
    while (nextUrl) {
      logger.debug({ nextUrl, params, page }, 'Requesting Octopus API page');
      let response: AxiosResponse<OctopusUnitRatesResponse>;
      try {
        response = await axios.get<OctopusUnitRatesResponse>(nextUrl, {
          params,
          auth: {
            username: apiKey,
            password: '',
          },
        });
      } catch (err) {
        logger.error({
          url: nextUrl,
          params,
          page,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          isAxiosError: axios.isAxiosError(err),
          response: axios.isAxiosError(err) ? {
            status: err.response?.status,
            data: err.response?.data,
            headers: err.response?.headers,
          } : undefined,
        }, 'Error during Octopus API request');
        throw err;
      }

      const prices = response.data.results.map((rate: OctopusUnitRate) => ({
        validFrom: rate.valid_from,
        validTo: rate.valid_to,
        valueIncVat: rate.value_inc_vat,
        valueExcVat: rate.value_exc_vat,
        region,
      }));

      allPrices.push(...prices);
      nextUrl = response.data.next;
      page++;

      // Clear params after first request (next URL includes them)
      if (nextUrl) {
        params.period_from = '';
        params.period_to = '';
      }
    }

    // Sort by validFrom ascending
    allPrices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

    logger.info({ count: allPrices.length, region, params }, 'Fetched Octopus prices (success)');
    return allPrices;
  } catch (error) {
    logger.error({
      url,
      params,
      region,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      isAxiosError: axios.isAxiosError(error),
      response: axios.isAxiosError(error) ? {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      } : undefined,
    }, 'Octopus API error (outer catch)');
    if (axios.isAxiosError(error)) {
      throw new Error(`Octopus API error: ${error.response?.status || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch today's prices (from midnight to midnight)
 */
export async function fetchTodayPrices(region: string): Promise<Price[]> {
  logger.info({ region }, 'Fetching today\'s prices');
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const prices = await fetchAgileprices({
      region,
      periodFrom: startOfDay.toISOString(),
      periodTo: endOfDay.toISOString(),
    });
    logger.info({ count: prices.length, region }, 'Fetched today\'s prices');
    return prices;
  } catch (error) {
    logger.error({ region, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Error fetching today\'s prices');
    throw error;
  }
}

/**
 * Fetch tomorrow's prices (released at ~16:00 daily)
 */
export async function fetchTomorrowPrices(region: string): Promise<Price[]> {
  logger.info({ region }, 'Fetching tomorrow\'s prices');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  try {
    const prices = await fetchAgileprices({
      region,
      periodFrom: tomorrow.toISOString(),
      periodTo: endOfTomorrow.toISOString(),
    });
    logger.info({ count: prices.length, region }, 'Fetched tomorrow\'s prices');
    return prices;
  } catch (error) {
    logger.error({ region, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Error fetching tomorrow\'s prices');
    throw error;
  }
}

/**
 * Fetch prices for the Agile pricing window (23:00 to 23:00 next day)
 */
export async function fetchAgileDayPrices(region: string): Promise<Price[]> {
  logger.info({ region }, 'Fetching Agile day prices');
  const now = new Date();

  // Agile day runs 23:00 to 23:00
  // If we're before 23:00, get yesterday 23:00 to today 23:00
  // If we're after 23:00, get today 23:00 to tomorrow 23:00
  const currentHour = now.getHours();

  let periodFrom: Date;
  let periodTo: Date;

  if (currentHour < 23) {
    // Before 23:00 - show yesterday 23:00 to today 23:00
    periodFrom = new Date(now);
    periodFrom.setDate(periodFrom.getDate() - 1);
    periodFrom.setHours(23, 0, 0, 0);

    periodTo = new Date(now);
    periodTo.setHours(23, 0, 0, 0);
  } else {
    // After 23:00 - show today 23:00 to tomorrow 23:00
    periodFrom = new Date(now);
    periodFrom.setHours(23, 0, 0, 0);

    periodTo = new Date(now);
    periodTo.setDate(periodTo.getDate() + 1);
    periodTo.setHours(23, 0, 0, 0);
  }

  try {
    const prices = await fetchAgileprices({
      region,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
    });
    logger.info({ count: prices.length, region }, 'Fetched Agile day prices');
    return prices;
  } catch (error) {
    logger.error({ region, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Error fetching Agile day prices');
    throw error;
  }
}
