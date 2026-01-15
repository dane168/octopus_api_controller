import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Power, Clock, Loader2, X, ToggleLeft, ToggleRight, Zap, History, CheckCircle, XCircle, Pencil, AlertTriangle, Layers } from 'lucide-react';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, useToggleSchedule, useScheduleLogs, useEffectiveSchedules } from '../hooks/useSchedules';
import { useDevices } from '../hooks/useDevices';
import { useNext24HoursPrices } from '../hooks/usePrices';
import type { Device, Price, ScheduleWithDevices, TimeSlotsConfig, DeviceAction, TimeSlot, EffectiveDeviceSchedule, ScheduleConflict, EffectiveSlot } from '@octopus-controller/shared';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSlotTime(slot: TimeSlot): string {
  return `${slot.start} - ${slot.end}`;
}

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today ${time}`;
  } else if (isYesterday) {
    return `Yesterday ${time}`;
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${time}`;
  }
}

function getPriceColor(p: number): string {
  if (p < 0) return 'bg-green-500';
  if (p < 10) return 'bg-green-500';
  if (p < 15) return 'bg-lime-500';
  if (p < 20) return 'bg-yellow-500';
  if (p < 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onToggle,
  onViewLogs,
  isDeleting,
  isToggling,
}: {
  schedule: ScheduleWithDevices;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onViewLogs: () => void;
  isDeleting: boolean;
  isToggling: boolean;
}) {
  const config = schedule.config as TimeSlotsConfig;

  return (
    <div className={`card p-4 ${!schedule.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{schedule.name}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {schedule.devices.map((d) => (
              <span key={d.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {d.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onViewLogs}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="View execution logs"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Edit schedule"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            disabled={isToggling}
            className={`p-1.5 rounded ${schedule.enabled ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
            title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
          >
            {isToggling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : schedule.enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            title="Delete schedule"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Action badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            config.action === 'on'
              ? 'bg-green-100 text-green-700'
              : config.action === 'off'
              ? 'bg-red-100 text-red-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {config.action.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">{config.repeat === 'daily' ? 'Daily' : 'One-time'}</span>
      </div>

      {/* Time slots */}
      <div className="flex flex-wrap gap-1">
        {config.slots.map((slot, idx) => (
          <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatSlotTime(slot)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScheduleLogsModal({
  schedule,
  isOpen,
  onClose,
}: {
  schedule: ScheduleWithDevices | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: logs, isLoading } = useScheduleLogs(schedule?.id || '', 50);

  if (!isOpen || !schedule) return null;

  // Create a device name lookup
  const deviceNames = new Map(schedule.devices.map(d => [d.id, d.name]));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Execution Logs</h2>
            <p className="text-sm text-gray-500">{schedule.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${log.success ? 'text-green-500' : 'text-red-500'}`}>
                      {log.success ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {deviceNames.get(log.deviceId) || log.deviceId.slice(0, 8)}
                        </span>
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            log.action === 'on'
                              ? 'bg-green-100 text-green-700'
                              : log.action === 'off'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{log.triggerReason}</p>
                      {!log.success && log.errorMessage && (
                        <p className="text-xs text-red-600 mt-1 bg-red-50 p-1.5 rounded">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {formatLogTime(log.executedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <History className="w-10 h-10 text-gray-300 mb-2" />
              <p className="font-medium">No logs yet</p>
              <p className="text-sm">Logs will appear here when the schedule runs</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeSlotSelector({
  prices,
  selectedSlots,
  onToggleSlot,
}: {
  prices: Price[];
  selectedSlots: Set<string>;
  onToggleSlot: (slotKey: string, slot: TimeSlot) => void;
}) {
  const now = new Date();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
      {prices.map((price) => {
        const from = new Date(price.validFrom);
        const to = new Date(price.validTo);
        const isPast = to < now;
        const isCurrent = now >= from && now < to;
        const slotKey = `${formatTime(price.validFrom)}-${formatTime(price.validTo)}`;
        const slot: TimeSlot = {
          start: formatTime(price.validFrom),
          end: formatTime(price.validTo),
        };
        const isSelected = selectedSlots.has(slotKey);

        return (
          <button
            key={price.validFrom}
            onClick={() => !isPast && onToggleSlot(slotKey, slot)}
            disabled={isPast}
            className={`
              p-2 rounded-lg border text-left transition-all
              ${isPast ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:border-blue-400'}
              ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200'}
              ${isCurrent && !isSelected ? 'border-blue-300' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">
                {formatTime(price.validFrom)}
              </span>
              {isCurrent && (
                <span className="text-[10px] bg-blue-600 text-white px-1 rounded">NOW</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${getPriceColor(price.valueIncVat)}`} />
              <span className="text-sm font-semibold">{price.valueIncVat.toFixed(1)}p</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DeviceSelector({
  devices,
  selectedDevices,
  onToggleDevice,
}: {
  devices: Device[];
  selectedDevices: Set<string>;
  onToggleDevice: (deviceId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
      {devices.map((device) => {
        const isSelected = selectedDevices.has(device.id);

        return (
          <button
            key={device.id}
            onClick={() => onToggleDevice(device.id)}
            className={`
              p-3 rounded-lg border text-left transition-all flex items-center gap-3
              ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-400'}
            `}
          >
            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Power className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{device.name}</div>
              <div className="text-xs text-gray-500 capitalize">{device.type.replace('_', ' ')}</div>
            </div>
            {isSelected && (
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleModal({
  isOpen,
  onClose,
  devices,
  prices,
  onSubmit,
  isSubmitting,
  editingSchedule,
}: {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  prices: Price[];
  onSubmit: (name: string, deviceIds: string[], slots: TimeSlot[], action: DeviceAction, repeat: 'once' | 'daily') => void;
  isSubmitting: boolean;
  editingSchedule?: ScheduleWithDevices | null;
}) {
  const isEditMode = !!editingSchedule;
  const [name, setName] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Map<string, TimeSlot>>(new Map());
  const [action, setAction] = useState<DeviceAction>('on');
  const [repeat, setRepeat] = useState<'once' | 'daily'>('daily');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Pre-populate form when editing
  useEffect(() => {
    if (isOpen && editingSchedule) {
      const config = editingSchedule.config as TimeSlotsConfig;
      setName(editingSchedule.name);
      setSelectedDevices(new Set(editingSchedule.deviceIds));
      // Convert slots array to Map
      const slotsMap = new Map<string, TimeSlot>();
      config.slots.forEach(slot => {
        const slotKey = `${slot.start}-${slot.end}`;
        slotsMap.set(slotKey, slot);
      });
      setSelectedSlots(slotsMap);
      setAction(config.action);
      setRepeat(config.repeat);
      setStep(1);
    }
  }, [isOpen, editingSchedule]);

  if (!isOpen) return null;

  const handleToggleDevice = (deviceId: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      newSelected.add(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  const handleToggleSlot = (slotKey: string, slot: TimeSlot) => {
    const newSelected = new Map(selectedSlots);
    if (newSelected.has(slotKey)) {
      newSelected.delete(slotKey);
    } else {
      newSelected.set(slotKey, slot);
    }
    setSelectedSlots(newSelected);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      name,
      Array.from(selectedDevices),
      Array.from(selectedSlots.values()),
      action,
      repeat
    );
  };

  const canProceedStep1 = selectedDevices.size > 0;
  const canProceedStep2 = selectedSlots.size > 0;
  const canSubmit = name.trim().length > 0 && canProceedStep1 && canProceedStep2;

  const resetForm = () => {
    setName('');
    setSelectedDevices(new Set());
    setSelectedSlots(new Map());
    setAction('on');
    setRepeat('daily');
    setStep(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{isEditMode ? 'Edit Schedule' : 'Create Schedule'}</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex border-b">
          <button
            onClick={() => setStep(1)}
            className={`flex-1 py-2 text-sm font-medium ${step === 1 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          >
            Devices
          </button>
          <button
            onClick={() => canProceedStep1 && setStep(2)}
            disabled={!canProceedStep1}
            className={`flex-1 py-2 text-sm font-medium ${step === 2 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'} disabled:opacity-50`}
          >
            Time Slots
          </button>
          <button
            onClick={() => canProceedStep1 && canProceedStep2 && setStep(3)}
            disabled={!canProceedStep1 || !canProceedStep2}
            className={`flex-1 py-2 text-sm font-medium ${step === 3 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'} disabled:opacity-50`}
          >
            Settings
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* Step 1: Select Devices */}
          {step === 1 && (
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">Select one or more devices to control:</p>
              {devices.length > 0 ? (
                <DeviceSelector
                  devices={devices}
                  selectedDevices={selectedDevices}
                  onToggleDevice={handleToggleDevice}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No devices configured. Add devices first.
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Time Slots */}
          {step === 2 && (
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                Select time windows (can select multiple, non-consecutive):
              </p>
              {prices.length > 0 ? (
                <TimeSlotSelector
                  prices={prices}
                  selectedSlots={new Set(selectedSlots.keys())}
                  onToggleSlot={handleToggleSlot}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No price data available. Refresh prices first.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Action & Name */}
          {step === 3 && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['on', 'off', 'toggle'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAction(a)}
                      className={`py-3 px-4 rounded-lg border font-medium transition-all ${
                        action === a
                          ? a === 'on'
                            ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                            : a === 'off'
                            ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200'
                            : 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {action === 'on' && 'Turn devices ON at slot start, OFF at slot end'}
                  {action === 'off' && 'Turn devices OFF at slot start'}
                  {action === 'toggle' && 'Toggle device state at slot start'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepeat('daily')}
                    className={`py-2 px-4 rounded-lg border font-medium transition-all ${
                      repeat === 'daily'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeat('once')}
                    className={`py-2 px-4 rounded-lg border font-medium transition-all ${
                      repeat === 'once'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    One-time
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Cheap rate heating"
                  className="input w-full"
                  required
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Devices:</span>{' '}
                    {selectedDevices.size} selected
                  </div>
                  <div>
                    <span className="font-medium">Time slots:</span>{' '}
                    {selectedSlots.size} selected
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.from(selectedSlots.values()).map((slot, idx) => (
                      <span key={idx} className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                        {formatSlotTime(slot)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-between gap-2 p-4 border-t bg-gray-50">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="btn btn-secondary"
            >
              Back
            </button>
          ) : (
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="btn btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Schedule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EffectiveSlotCard({ slot }: { slot: EffectiveSlot }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-medium">{slot.start} - {slot.end}</span>
      </div>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded ${
          slot.action === 'on'
            ? 'bg-green-100 text-green-700'
            : slot.action === 'off'
            ? 'bg-red-100 text-red-700'
            : 'bg-purple-100 text-purple-700'
        }`}
      >
        {slot.action.toUpperCase()}
      </span>
      {slot.sourceSchedules.length > 1 && (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Layers className="w-3 h-3" />
          {slot.sourceSchedules.length} merged
        </span>
      )}
    </div>
  );
}

function DeviceEffectiveScheduleCard({
  schedule,
  conflicts,
}: {
  schedule: EffectiveDeviceSchedule;
  conflicts: ScheduleConflict[];
}) {
  const deviceConflicts = conflicts.filter((c) => c.deviceId === schedule.deviceId);
  const hasConflicts = deviceConflicts.length > 0;

  return (
    <div className={`card p-4 ${hasConflicts ? 'border-red-300 bg-red-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${hasConflicts ? 'bg-red-100' : 'bg-blue-100'}`}>
            <Power className={`w-4 h-4 ${hasConflicts ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{schedule.deviceName}</h3>
            <p className="text-xs text-gray-500">{schedule.slots.length} effective slot{schedule.slots.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {hasConflicts && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Conflict</span>
          </div>
        )}
      </div>

      {/* Effective slots */}
      <div className="space-y-2">
        {schedule.slots.map((slot, idx) => (
          <EffectiveSlotCard key={idx} slot={slot} />
        ))}
      </div>

      {/* Conflict details */}
      {hasConflicts && (
        <div className="mt-3 p-2 bg-red-100 rounded-lg">
          <p className="text-xs font-medium text-red-700 mb-1">Schedule Conflicts:</p>
          {deviceConflicts.map((conflict, idx) => (
            <div key={idx} className="text-xs text-red-600">
              {conflict.timeSlot.start}-{conflict.timeSlot.end}:{' '}
              {conflict.conflictingActions.map((a) => `${a.scheduleName} (${a.action})`).join(' vs ')}
            </div>
          ))}
        </div>
      )}

      {/* Source schedules */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-1">Contributing schedules:</p>
        <div className="flex flex-wrap gap-1">
          {[...new Set(schedule.slots.flatMap((s) => s.sourceSchedules.map((ss) => ss.name)))].map(
            (name) => (
              <span key={name} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                {name}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EffectiveSchedulesView({
  effectiveSchedules,
  conflicts,
  isLoading,
}: {
  effectiveSchedules: EffectiveDeviceSchedule[];
  conflicts: ScheduleConflict[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (effectiveSchedules.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">No Active Schedules</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Enable some schedules to see the effective schedule per device here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Conflict summary banner */}
      {conflicts.length > 0 && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Schedule Conflicts Detected</h3>
            <p className="text-sm text-red-700 mt-1">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found. Some devices have
              overlapping schedules with different actions. Review the affected devices below.
            </p>
          </div>
        </div>
      )}

      {/* Device cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {effectiveSchedules.map((schedule) => (
          <DeviceEffectiveScheduleCard
            key={schedule.deviceId}
            schedule={schedule}
            conflicts={conflicts}
          />
        ))}
      </div>
    </div>
  );
}

export function Schedules() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'effective'>('schedules');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithDevices | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [logsSchedule, setLogsSchedule] = useState<ScheduleWithDevices | null>(null);

  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const { data: effectiveData, isLoading: effectiveLoading } = useEffectiveSchedules();
  const { data: devices } = useDevices();
  const { data: prices } = useNext24HoursPrices();

  const createMutation = useCreateSchedule();
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();
  const toggleMutation = useToggleSchedule();

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: ScheduleWithDevices) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
  };

  const handleSubmitSchedule = async (
    name: string,
    deviceIds: string[],
    slots: TimeSlot[],
    action: DeviceAction,
    repeat: 'once' | 'daily'
  ) => {
    const config = {
      type: 'time_slots' as const,
      slots,
      action,
      repeat,
      date: repeat === 'once' ? new Date().toISOString().split('T')[0] : undefined,
    };

    if (editingSchedule) {
      await updateMutation.mutateAsync({
        id: editingSchedule.id,
        input: { name, deviceIds, config },
      });
    } else {
      await createMutation.mutateAsync({ name, deviceIds, config });
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      setDeletingId(id);
      try {
        await deleteMutation.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try {
      await toggleMutation.mutateAsync(id);
    } finally {
      setTogglingId(null);
    }
  };

  if (schedulesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasSchedules = schedules && schedules.length > 0;
  const hasDevices = devices && devices.length > 0;

  const effectiveSchedules = effectiveData?.effectiveSchedules || [];
  const conflicts = effectiveData?.conflicts || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500">Automate devices based on time slots</p>
        </div>
        {activeTab === 'schedules' && (
          <button
            onClick={handleOpenCreate}
            disabled={!hasDevices}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'schedules'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            My Schedules
          </span>
        </button>
        <button
          onClick={() => setActiveTab('effective')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'effective'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Effective View
            {conflicts.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {conflicts.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {activeTab === 'schedules' ? (
        <>
          {!hasDevices && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
              <p className="font-medium">No devices configured</p>
              <p className="text-sm">Add devices first before creating schedules.</p>
            </div>
          )}

          {hasSchedules ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  onEdit={() => handleOpenEdit(schedule)}
                  onDelete={() => handleDelete(schedule.id)}
                  onToggle={() => handleToggle(schedule.id)}
                  onViewLogs={() => setLogsSchedule(schedule)}
                  isDeleting={deletingId === schedule.id}
                  isToggling={togglingId === schedule.id}
                />
              ))}
            </div>
          ) : hasDevices ? (
            <div className="card p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-gray-900 mb-2">No Schedules Yet</h2>
              <p className="text-gray-500 max-w-md mx-auto mb-4">
                Create schedules to automatically control your devices during specific time windows.
              </p>
              <button
                onClick={handleOpenCreate}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Your First Schedule
              </button>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  How it works:
                </h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>1. Select one or more devices to control</li>
                  <li>2. Pick time windows (can be non-consecutive)</li>
                  <li>3. Choose action: ON, OFF, or Toggle</li>
                  <li>4. Set to run daily or one-time</li>
                </ul>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <EffectiveSchedulesView
          effectiveSchedules={effectiveSchedules}
          conflicts={conflicts}
          isLoading={effectiveLoading}
        />
      )}

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        devices={devices || []}
        prices={prices || []}
        onSubmit={handleSubmitSchedule}
        isSubmitting={editingSchedule ? updateMutation.isPending : createMutation.isPending}
        editingSchedule={editingSchedule}
      />

      <ScheduleLogsModal
        schedule={logsSchedule}
        isOpen={logsSchedule !== null}
        onClose={() => setLogsSchedule(null)}
      />

      {(createMutation.isError || updateMutation.isError) && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          {createMutation.error?.message || updateMutation.error?.message}
        </div>
      )}
    </div>
  );
}
