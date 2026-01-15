import type {
  Schedule,
  TimeSlotsConfig,
  EffectiveSlot,
  EffectiveDeviceSchedule,
  ScheduleConflict,
  DeviceAction,
} from '@octopus-controller/shared';
import * as devicesRepo from '../repositories/devices.js';

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/**
 * Convert minutes since midnight back to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440; // Handle negative and overflow
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if two time slots are adjacent (one ends where the other starts)
 */
function areSlotsAdjacent(slot1End: string, slot2Start: string): boolean {
  return slot1End === slot2Start;
}

/**
 * Check if two time slots overlap
 */
function doSlotsOverlap(
  slot1Start: string,
  slot1End: string,
  slot2Start: string,
  slot2End: string
): boolean {
  const s1Start = timeToMinutes(slot1Start);
  let s1End = timeToMinutes(slot1End);
  const s2Start = timeToMinutes(slot2Start);
  let s2End = timeToMinutes(slot2End);

  // Handle midnight wraparound (e.g., 23:00-00:30)
  if (s1End <= s1Start) s1End += 1440;
  if (s2End <= s2Start) s2End += 1440;

  // Check for overlap
  return s1Start < s2End && s2Start < s1End;
}

interface RawSlot {
  start: string;
  end: string;
  action: DeviceAction;
  scheduleId: string;
  scheduleName: string;
}

/**
 * Merge adjacent slots with the same action
 * Returns merged slots sorted by start time
 */
function mergeAdjacentSlots(slots: RawSlot[]): EffectiveSlot[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const merged: EffectiveSlot[] = [];
  let current: EffectiveSlot = {
    start: sorted[0].start,
    end: sorted[0].end,
    action: sorted[0].action,
    sourceSchedules: [{ id: sorted[0].scheduleId, name: sorted[0].scheduleName }],
  };

  for (let i = 1; i < sorted.length; i++) {
    const slot = sorted[i];

    // Check if this slot can be merged with current
    // Must be adjacent AND have the same action
    if (areSlotsAdjacent(current.end, slot.start) && current.action === slot.action) {
      // Extend current slot
      current.end = slot.end;
      // Add source schedule if not already present
      if (!current.sourceSchedules.some((s) => s.id === slot.scheduleId)) {
        current.sourceSchedules.push({ id: slot.scheduleId, name: slot.scheduleName });
      }
    } else {
      // Save current and start new
      merged.push(current);
      current = {
        start: slot.start,
        end: slot.end,
        action: slot.action,
        sourceSchedules: [{ id: slot.scheduleId, name: slot.scheduleName }],
      };
    }
  }

  // Don't forget the last one
  merged.push(current);

  return merged;
}

/**
 * Detect conflicts where a device has different actions at overlapping times
 */
function detectConflicts(slots: RawSlot[], deviceId: string, deviceName: string): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Compare each pair of slots
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slot1 = slots[i];
      const slot2 = slots[j];

      // Check if they overlap and have different actions
      if (
        slot1.action !== slot2.action &&
        doSlotsOverlap(slot1.start, slot1.end, slot2.start, slot2.end)
      ) {
        // Calculate the overlapping time range
        const overlapStart = minutesToTime(
          Math.max(timeToMinutes(slot1.start), timeToMinutes(slot2.start))
        );
        const overlapEnd = minutesToTime(
          Math.min(timeToMinutes(slot1.end), timeToMinutes(slot2.end))
        );

        // Check if we already have a conflict for this time slot
        const existingConflict = conflicts.find(
          (c) => c.timeSlot.start === overlapStart && c.timeSlot.end === overlapEnd
        );

        if (existingConflict) {
          // Add to existing conflict if schedules not already listed
          if (!existingConflict.conflictingActions.some((a) => a.scheduleId === slot1.scheduleId)) {
            existingConflict.conflictingActions.push({
              scheduleId: slot1.scheduleId,
              scheduleName: slot1.scheduleName,
              action: slot1.action,
            });
          }
          if (!existingConflict.conflictingActions.some((a) => a.scheduleId === slot2.scheduleId)) {
            existingConflict.conflictingActions.push({
              scheduleId: slot2.scheduleId,
              scheduleName: slot2.scheduleName,
              action: slot2.action,
            });
          }
        } else {
          // Create new conflict
          conflicts.push({
            deviceId,
            deviceName,
            timeSlot: { start: overlapStart, end: overlapEnd },
            conflictingActions: [
              {
                scheduleId: slot1.scheduleId,
                scheduleName: slot1.scheduleName,
                action: slot1.action,
              },
              {
                scheduleId: slot2.scheduleId,
                scheduleName: slot2.scheduleName,
                action: slot2.action,
              },
            ],
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Resolve all enabled schedules into effective schedules per device
 * This merges adjacent time slots and detects conflicts
 */
export async function resolveSchedules(
  schedules: Schedule[]
): Promise<{
  effectiveSchedules: EffectiveDeviceSchedule[];
  conflicts: ScheduleConflict[];
}> {
  // Get all devices for name lookup
  const allDevices = await devicesRepo.getAllDevices();
  const deviceNames = new Map(allDevices.map((d) => [d.id, d.name]));

  // Group slots by device
  const deviceSlots = new Map<string, RawSlot[]>();

  for (const schedule of schedules) {
    // Only process time_slots schedules for now
    if (schedule.config.type !== 'time_slots') continue;

    const config = schedule.config as TimeSlotsConfig;

    // For 'once' schedules, check if it's today
    if (config.repeat === 'once' && config.date) {
      const today = new Date().toISOString().split('T')[0];
      if (config.date !== today) continue;
    }

    // Add each slot for each device
    for (const deviceId of schedule.deviceIds) {
      if (!deviceSlots.has(deviceId)) {
        deviceSlots.set(deviceId, []);
      }

      for (const slot of config.slots) {
        deviceSlots.get(deviceId)!.push({
          start: slot.start,
          end: slot.end,
          action: config.action,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
        });
      }
    }
  }

  // Process each device
  const effectiveSchedules: EffectiveDeviceSchedule[] = [];
  const allConflicts: ScheduleConflict[] = [];

  for (const [deviceId, slots] of deviceSlots) {
    const deviceName = deviceNames.get(deviceId) || deviceId;

    // Detect conflicts first (before merging)
    const conflicts = detectConflicts(slots, deviceId, deviceName);
    allConflicts.push(...conflicts);

    // Group slots by action for merging
    const onSlots = slots.filter((s) => s.action === 'on');
    const offSlots = slots.filter((s) => s.action === 'off');
    const toggleSlots = slots.filter((s) => s.action === 'toggle');

    // Merge adjacent slots for each action type
    const mergedSlots = [
      ...mergeAdjacentSlots(onSlots),
      ...mergeAdjacentSlots(offSlots),
      ...mergeAdjacentSlots(toggleSlots),
    ].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    effectiveSchedules.push({
      deviceId,
      deviceName,
      slots: mergedSlots,
    });
  }

  return { effectiveSchedules, conflicts: allConflicts };
}

/**
 * Get the effective action for a specific device at the current time
 * Returns null if no schedule applies
 */
export function getEffectiveActionForDevice(
  effectiveSchedule: EffectiveDeviceSchedule,
  now: Date
): { action: DeviceAction; slot: EffectiveSlot } | null {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of effectiveSchedule.slots) {
    const slotStart = timeToMinutes(slot.start);
    let slotEnd = timeToMinutes(slot.end);

    // Handle midnight wraparound
    if (slotEnd <= slotStart) slotEnd += 1440;

    // Check if we're at the exact start of this slot
    if (currentMinutes === slotStart) {
      return { action: slot.action, slot };
    }
  }

  return null;
}

/**
 * Check if it's the exact end of a slot for a device
 * Used to turn off devices at slot end
 */
export function getEndingSlotForDevice(
  effectiveSchedule: EffectiveDeviceSchedule,
  now: Date
): EffectiveSlot | null {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of effectiveSchedule.slots) {
    let slotEnd = timeToMinutes(slot.end);

    // Handle midnight (00:00 means end of day)
    if (slotEnd === 0) slotEnd = 1440;

    if (currentMinutes === slotEnd) {
      return slot;
    }
  }

  return null;
}
