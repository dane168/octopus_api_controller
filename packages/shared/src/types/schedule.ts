import type { DeviceAction } from './device.js';

/**
 * Schedule types for device automation
 */
export type ScheduleType = 'price_threshold' | 'cheapest_hours' | 'time_range' | 'time_slots';

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
 * Time slot - represents a 30-minute price window
 */
export interface TimeSlot {
  start: string;              // HH:MM format (e.g., "17:30")
  end: string;                // HH:MM format (e.g., "18:00")
}

/**
 * Time slots schedule - run during specific half-hour price windows
 * This is the primary schedule type for manual window selection
 */
export interface TimeSlotsConfig {
  type: 'time_slots';
  slots: TimeSlot[];          // Selected time slots
  action: DeviceAction;       // 'on', 'off', or 'toggle'
  repeat: 'once' | 'daily';   // Run once or repeat daily
  date?: string;              // ISO date for 'once' schedules (YYYY-MM-DD)
}

/**
 * Union type for all schedule configurations
 */
export type ScheduleConfig = PriceThresholdConfig | CheapestHoursConfig | TimeRangeConfig | TimeSlotsConfig;

/**
 * Schedule entity stored in database
 * Note: Now supports multiple devices per schedule
 */
export interface Schedule {
  id: string;
  deviceIds: string[];        // Array of device IDs (supports multiple devices)
  name: string;
  enabled: boolean;
  config: ScheduleConfig;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Device info for schedule display
 */
export interface ScheduleDeviceInfo {
  id: string;
  name: string;
}

/**
 * Schedule with device info for display
 */
export interface ScheduleWithDevices extends Schedule {
  devices: ScheduleDeviceInfo[];
}

/**
 * Input for creating a new schedule
 */
export interface CreateScheduleInput {
  deviceIds: string[];        // Array of device IDs
  name: string;
  config: ScheduleConfig;
}

/**
 * Input for updating a schedule
 */
export interface UpdateScheduleInput {
  name?: string;
  deviceIds?: string[];
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
  action: 'on' | 'off' | 'toggle';
  triggerReason: string;
  success: boolean;
  errorMessage?: string;
  executedAt: string;
}

/**
 * Schedule evaluation result
 */
export interface ScheduleEvaluationResult {
  shouldExecute: boolean;
  action: DeviceAction;
  reason: string;
}

/**
 * Enriched schedule log with device and schedule names for display
 */
export interface EnrichedScheduleLog extends ScheduleLog {
  scheduleName: string;
  deviceName: string;
}

/**
 * Effective time slot after merging adjacent slots
 * Represents the actual time a device will be controlled
 */
export interface EffectiveSlot {
  start: string;                // HH:MM format
  end: string;                  // HH:MM format
  action: DeviceAction;
  sourceSchedules: {            // Which schedules contributed to this slot
    id: string;
    name: string;
  }[];
}

/**
 * Effective schedule for a single device
 * Shows merged slots from all schedules affecting this device
 */
export interface EffectiveDeviceSchedule {
  deviceId: string;
  deviceName: string;
  slots: EffectiveSlot[];
}

/**
 * Schedule conflict - when a device has conflicting actions at the same time
 */
export interface ScheduleConflict {
  deviceId: string;
  deviceName: string;
  timeSlot: {
    start: string;
    end: string;
  };
  conflictingActions: {
    scheduleId: string;
    scheduleName: string;
    action: DeviceAction;
  }[];
}
