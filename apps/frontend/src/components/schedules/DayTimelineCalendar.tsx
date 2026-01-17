import { useEffect, useState } from 'react';
import { Clock, Power, AlertTriangle } from 'lucide-react';
import type { EffectiveDeviceSchedule, ScheduleConflict } from '@octopus-controller/shared';

interface DayTimelineCalendarProps {
  effectiveSchedules: EffectiveDeviceSchedule[];
  conflicts: ScheduleConflict[];
}

// Convert HH:MM to minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes to percentage of day (0-100)
function minutesToPercent(minutes: number): number {
  return (minutes / 1440) * 100;
}

// Format hour for display
function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// Get current time as percentage of day
function getCurrentTimePercent(): number {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutesToPercent(minutes);
}

export function DayTimelineCalendar({ effectiveSchedules, conflicts }: DayTimelineCalendarProps) {
  const [currentTimePercent, setCurrentTimePercent] = useState(getCurrentTimePercent);

  // Update current time indicator every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimePercent(getCurrentTimePercent());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Hours to show on timeline (every 3 hours for cleaner display)
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  // Check if a device has conflicts
  const deviceHasConflicts = (deviceId: string) =>
    conflicts.some(c => c.deviceId === deviceId);

  // Check if a specific slot overlaps with a conflict
  const slotHasConflict = (deviceId: string, start: string, end: string) => {
    return conflicts.some(c => {
      if (c.deviceId !== deviceId) return false;
      const slotStart = timeToMinutes(start);
      const slotEnd = timeToMinutes(end);
      const conflictStart = timeToMinutes(c.timeSlot.start);
      const conflictEnd = timeToMinutes(c.timeSlot.end);
      // Check for overlap
      return slotStart < conflictEnd && slotEnd > conflictStart;
    });
  };

  if (effectiveSchedules.length === 0) {
    return null;
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Daily Schedule Timeline</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          Now: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-green-500 rounded-sm" />
          <span className="text-gray-600 dark:text-gray-400">ON</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-red-500 rounded-sm" />
          <span className="text-gray-600 dark:text-gray-400">OFF</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-purple-500 rounded-sm" />
          <span className="text-gray-600 dark:text-gray-400">TOGGLE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-sm border border-yellow-600" />
          <span className="text-gray-600 dark:text-gray-400">Conflict</span>
        </div>
      </div>

      {/* Timeline container */}
      <div className="relative">
        {/* Hour labels - aligned with timeline bars */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-32 flex-shrink-0" /> {/* Spacer for device name column */}
          <div className="flex-1 relative h-5">
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute text-xs text-gray-500 dark:text-gray-400 -translate-x-1/2"
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
        </div>

        {/* Device rows */}
        <div className="space-y-2">
          {effectiveSchedules.map(schedule => {
            const hasConflicts = deviceHasConflicts(schedule.deviceId);

            return (
              <div key={schedule.deviceId} className="flex items-center gap-2">
                {/* Device name */}
                <div className={`w-32 flex-shrink-0 flex items-center gap-1.5 pr-2 ${hasConflicts ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  <Power className={`w-3.5 h-3.5 flex-shrink-0 ${hasConflicts ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span className="text-sm font-medium truncate" title={schedule.deviceName}>
                    {schedule.deviceName}
                  </span>
                  {hasConflicts && <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />}
                </div>

                {/* Timeline bar - no overflow-hidden so tooltips can show */}
                <div className="flex-1 relative h-8 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  {/* Hour grid lines */}
                  {hours.slice(1, -1).map(hour => (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-600"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  {/* Current time indicator per row */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                    style={{ left: `${currentTimePercent}%` }}
                  />

                  {/* Schedule slots */}
                  {schedule.slots.map((slot, idx) => {
                    const startMinutes = timeToMinutes(slot.start);
                    const endMinutes = timeToMinutes(slot.end);
                    const startPercent = minutesToPercent(startMinutes);
                    const widthPercent = minutesToPercent(endMinutes - startMinutes);
                    const isConflict = slotHasConflict(schedule.deviceId, slot.start, slot.end);

                    // Action colors
                    const colorClass = isConflict
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 border-2 border-yellow-600'
                      : slot.action === 'on'
                      ? 'bg-green-500'
                      : slot.action === 'off'
                      ? 'bg-red-500'
                      : 'bg-purple-500';

                    return (
                      <div
                        key={idx}
                        className={`absolute top-1 bottom-1 rounded ${colorClass} cursor-pointer hover:opacity-80 transition-opacity group z-0`}
                        style={{
                          left: `${startPercent}%`,
                          width: `${Math.max(widthPercent, 0.5)}%`, // Min width for visibility
                        }}
                        title={`${slot.start} - ${slot.end}: ${slot.action.toUpperCase()}${slot.sourceSchedules.length > 1 ? ` (${slot.sourceSchedules.length} schedules merged)` : ''}`}
                      >
                        {/* Tooltip on hover - positioned above with high z-index */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                            <div className="font-medium">{slot.start} - {slot.end}</div>
                            <div className={`${slot.action === 'on' ? 'text-green-300' : slot.action === 'off' ? 'text-red-300' : 'text-purple-300'}`}>
                              {slot.action.toUpperCase()}
                            </div>
                            {slot.sourceSchedules.length > 1 && (
                              <div className="text-gray-400 text-[10px] mt-1">
                                {slot.sourceSchedules.map(s => s.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Showing {effectiveSchedules.length} device{effectiveSchedules.length !== 1 ? 's' : ''} with active schedules
        {conflicts.length > 0 && (
          <span className="text-red-600 dark:text-red-400 ml-2">
            ({conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected)
          </span>
        )}
      </div>
    </div>
  );
}
