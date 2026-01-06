/**
 * Represents a single half-hourly electricity price from Octopus Agile
 */
export interface Price {
  id?: number;
  validFrom: string;      // ISO 8601 timestamp
  validTo: string;        // ISO 8601 timestamp
  valueIncVat: number;    // Price in p/kWh including VAT
  valueExcVat: number;    // Price in p/kWh excluding VAT
  region: string;         // Electricity region code (A-P)
}

/**
 * Price with additional computed fields for display
 */
export interface PriceDisplay extends Price {
  isCurrent: boolean;
  priceLevel: PriceLevel;
}

/**
 * Price level classification for UI color coding
 */
export type PriceLevel = 'very_cheap' | 'cheap' | 'normal' | 'expensive' | 'very_expensive';

/**
 * Helper to classify price into levels
 */
export function getPriceLevel(priceIncVat: number): PriceLevel {
  if (priceIncVat < 0) return 'very_cheap';    // Negative prices (plunge pricing)
  if (priceIncVat < 10) return 'cheap';
  if (priceIncVat < 20) return 'normal';
  if (priceIncVat < 30) return 'expensive';
  return 'very_expensive';
}

/**
 * Price threshold configuration for color coding
 */
export const PRICE_THRESHOLDS = {
  VERY_CHEAP: 0,
  CHEAP: 10,
  NORMAL: 20,
  EXPENSIVE: 30,
} as const;

/**
 * API response from Octopus Energy for unit rates
 */
export interface OctopusUnitRatesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: OctopusUnitRate[];
}

export interface OctopusUnitRate {
  value_exc_vat: number;
  value_inc_vat: number;
  valid_from: string;
  valid_to: string;
  payment_method: string | null;
}

/**
 * Query parameters for fetching prices
 */
export interface PriceQuery {
  from?: string;
  to?: string;
  region?: string;
}

/**
 * Query for finding cheapest hours
 */
export interface CheapestHoursQuery {
  hours: number;
  from?: string;
  to?: string;
  consecutive?: boolean;
}
