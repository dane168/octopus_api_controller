/**
 * Application settings
 */
export interface AppSettings {
  region: string;             // Electricity region code (A-P)
  octopusApiKey?: string;     // Optional API key for consumption data
  octopusMpan?: string;       // Meter Point Administration Number
  octopusSerial?: string;     // Meter serial number
}

/**
 * Valid Octopus Energy regions
 * Each region has different pricing
 */
export const OCTOPUS_REGIONS = {
  A: 'Eastern England',
  B: 'East Midlands',
  C: 'London',
  D: 'Merseyside and Northern Wales',
  E: 'West Midlands',
  F: 'North Eastern England',
  G: 'North Western England',
  H: 'Southern England',
  J: 'South Eastern England',
  K: 'Southern Wales',
  L: 'South Western England',
  M: 'Yorkshire',
  N: 'Southern Scotland',
  P: 'Northern Scotland',
} as const;

export type OctopusRegion = keyof typeof OCTOPUS_REGIONS;

/**
 * Check if a string is a valid region code
 */
export function isValidRegion(region: string): region is OctopusRegion {
  return region in OCTOPUS_REGIONS;
}
