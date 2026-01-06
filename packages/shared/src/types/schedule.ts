/**
 * Schedule types for device automation
 */
export type ScheduleType = 'price_threshold' | 'cheapest_hours' | 'time_range';

/**
 * Price threshold schedule - turn on when price is below threshold
 */
export interface PriceThresholdConfig {
  type: 'price_threshold';
  maxPrice: number;           // Maximum price in p/kWh to trigger
  minRuntime?: number;        // Minimum minutes to run once triggered
}

/**
 * Cheapest hours schedule - turn on during cheapest N hours in a window
 */
export interface CheapestHoursConfig {
  type: 'cheapest_hours';
  hours: number;              // Number of hours needed (can be decimal, e.g., 1.5)
  windowStart: string;        // HH:MM - start of consideration window
  windowEnd: string;          // HH:MM - end of consideration window
  consecutive?: boolean;      // Must be consecutive hours
}

/**
 * Time range schedule - turn on during specific time windows
 */
export interface TimeRangeConfig {
  type: 'time_range';
  ranges: TimeRange[];
}

export interface TimeRange {
  start: string;              // HH:MM format
  end: string;                // HH:MM format
  days?: number[];            // 0-6 (Sun-Sat), empty/undefined = all days
}

/**
 * Union type for all schedule configurations
 */
export type ScheduleConfig = PriceThresholdConfig | CheapestHoursConfig | TimeRangeConfig;

/**
 * Schedule entity stored in database
 */
export interface Schedule {
  id: string;
  deviceId: string;
  name: string;
  enabled: boolean;
  config: ScheduleConfig;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Schedule with device info for display
 */
export interface ScheduleWithDevice extends Schedule {
  deviceName: string;
}

/**
 * Input for creating a new schedule
 */
export interface CreateScheduleInput {
  deviceId: string;
  name: string;
  config: ScheduleConfig;
}

/**
 * Input for updating a schedule
 */
export interface UpdateScheduleInput {
  name?: string;
  config?: ScheduleConfig;
  enabled?: boolean;
}

/**
 * Schedule execution log entry
 */
export interface ScheduleLog {
  id?: number;
  scheduleId: string;
  deviceId: string;
  action: 'on' | 'off';
  triggerReason: string;
  success: boolean;
  errorMessage?: string;
  executedAt: string;
}

/**
 * Schedule evaluation result
 */
export interface ScheduleEvaluationResult {
  shouldBeOn: boolean;
  reason: string;
}
