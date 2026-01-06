import axios, { type AxiosResponse } from 'axios';
import type { OctopusUnitRatesResponse, OctopusUnitRate, Price } from '@octopus-controller/shared';
import { logger } from '../../utils/logger.js';

const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1';

// Current Agile tariff product code
const AGILE_PRODUCT_CODE = 'AGILE-FLEX-22-11-25';

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

  logger.debug({ url, params }, 'Fetching Octopus prices');

  try {
    const allPrices: Price[] = [];
    let nextUrl: string | null = url;

    // Handle pagination
    while (nextUrl) {
      const response: AxiosResponse<OctopusUnitRatesResponse> = await axios.get<OctopusUnitRatesResponse>(nextUrl, { params });

      const prices = response.data.results.map((rate: OctopusUnitRate) => ({
        validFrom: rate.valid_from,
        validTo: rate.valid_to,
        valueIncVat: rate.value_inc_vat,
        valueExcVat: rate.value_exc_vat,
        region,
      }));

      allPrices.push(...prices);
      nextUrl = response.data.next;

      // Clear params after first request (next URL includes them)
      if (nextUrl) {
        params.period_from = '';
        params.period_to = '';
      }
    }

    // Sort by validFrom ascending
    allPrices.sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime());

    logger.info({ count: allPrices.length, region }, 'Fetched Octopus prices');
    return allPrices;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        status: error.response?.status,
        data: error.response?.data,
        url
      }, 'Octopus API error');
      throw new Error(`Octopus API error: ${error.response?.status || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch today's prices (from midnight to midnight)
 */
export async function fetchTodayPrices(region: string): Promise<Price[]> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return fetchAgileprices({
    region,
    periodFrom: startOfDay.toISOString(),
    periodTo: endOfDay.toISOString(),
  });
}

/**
 * Fetch tomorrow's prices (released at ~16:00 daily)
 */
export async function fetchTomorrowPrices(region: string): Promise<Price[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  return fetchAgileprices({
    region,
    periodFrom: tomorrow.toISOString(),
    periodTo: endOfTomorrow.toISOString(),
  });
}

/**
 * Fetch prices for the Agile pricing window (23:00 to 23:00 next day)
 */
export async function fetchAgileDayPrices(region: string): Promise<Price[]> {
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

  return fetchAgileprices({
    region,
    periodFrom: periodFrom.toISOString(),
    periodTo: periodTo.toISOString(),
  });
}
