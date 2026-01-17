import { useState, useRef } from 'react';
import { Plug, Plus, Power, Trash2, Wifi, WifiOff, Loader2, X, Upload, Edit2, RefreshCw, Lightbulb, Cloud } from 'lucide-react';
import { useDevices, useCreateDevice, useUpdateDevice, useDeleteDevice, useControlDevice, useImportDevices, useCheckDeviceStatus } from '../hooks/useDevices';
// Note: useTestConnection removed - not needed for cloud-only protocol
import { useImportDevicesFromCloud } from '../hooks/useTuya';
import type { Device, DeviceType, CreateDeviceInput, UpdateDeviceInput } from '@octopus-controller/shared';

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'switch', label: 'Switch' },
  { value: 'plug', label: 'Smart Plug' },
  { value: 'light', label: 'Light' },
  { value: 'heater', label: 'Heater' },
  { value: 'thermostat', label: 'Thermostat' },
  { value: 'hot_water', label: 'Hot Water Tank' },
];

function DeviceCard({ device, onControl, onDelete, onEdit, onCheckStatus, isControlling, isCheckingStatus, powerState }: {
  device: Device;
  onControl: (action: 'on' | 'off' | 'toggle') => void;
  onDelete: () => void;
  onEdit: () => void;
  onCheckStatus: () => void;
  isControlling: boolean;
  isCheckingStatus: boolean;
  powerState: boolean | null;
}) {
  const isOnline = device.status === 'online';
  const isLight = device.type === 'light';

  // Choose icon based on device type
  const DeviceIcon = isLight ? Lightbulb : Plug;

  // Determine icon color based on power state and online status
  const getIconColor = () => {
    if (!isOnline) return 'text-gray-400 dark:text-gray-500';
    if (powerState === true) return isLight ? 'text-yellow-500 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
    if (powerState === false) return 'text-gray-400 dark:text-gray-500';
    return 'text-green-600 dark:text-green-400'; // Online but unknown power state
  };

  const getIconBg = () => {
    if (!isOnline) return 'bg-gray-100 dark:bg-gray-700';
    if (powerState === true) return isLight ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30';
    if (powerState === false) return 'bg-gray-100 dark:bg-gray-700';
    return 'bg-green-100 dark:bg-green-900/30';
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getIconBg()}`}>
            <DeviceIcon className={`w-5 h-5 ${getIconColor()}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{device.name}</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{device.type.replace('_', ' ')}</p>
              {isOnline && powerState !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${powerState ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {powerState ? 'ON' : 'OFF'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500 dark:text-green-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          )}
          <button
            onClick={onCheckStatus}
            disabled={isCheckingStatus}
            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 disabled:opacity-50"
            title="Check device status"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title="Edit device"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Show config summary */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded">
        <div className="truncate" title={device.config.deviceId}>ID: {device.config.deviceId?.slice(0, 16)}...</div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => onControl('on')}
            disabled={isControlling}
            className="btn btn-sm bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white disabled:opacity-50"
          >
            {isControlling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'On'}
          </button>
          <button
            onClick={() => onControl('off')}
            disabled={isControlling}
            className="btn btn-sm bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white disabled:opacity-50"
          >
            {isControlling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Off'}
          </button>
          <button
            onClick={() => onControl('toggle')}
            disabled={isControlling}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onDelete}
          className="btn btn-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {device.lastSeen && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Last seen: {new Date(device.lastSeen).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function AddDeviceModal({ isOpen, onClose, onSubmit, isSubmitting }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDeviceInput) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('plug');
  const [deviceId, setDeviceId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      type,
      config: {
        deviceId,
      },
    });
  };

  const canSubmit = name && deviceId && !isSubmitting;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-gray-100">Add Device</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Living Room Plug"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="input w-full"
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tuya Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="bf1234567890abcdef"
              className="input w-full font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Find this in your Tuya IoT Platform project.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Device
            </button>
          </div>
        </form>

        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Tip:</strong> Use the "Import from Tuya Cloud" button to automatically import all your devices.
          </p>
        </div>
      </div>
    </div>
  );
}

function EditDeviceModal({ device, isOpen, onClose, onSubmit, isSubmitting }: {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, input: UpdateDeviceInput) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(device?.name || '');
  const [type, setType] = useState<DeviceType>(device?.type || 'plug');
  const [deviceId, setDeviceId] = useState(device?.config.deviceId || '');

  // Update form when device changes
  if (device && name !== device.name && !isOpen) {
    setName(device.name);
    setType(device.type);
    setDeviceId(device.config.deviceId || '');
  }

  if (!isOpen || !device) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(device.id, {
      name,
      type,
      config: {
        deviceId,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-gray-100">Edit Device</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="input w-full"
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tuya Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="input w-full font-mono text-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || !deviceId || isSubmitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Devices() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [controllingDeviceId, setControllingDeviceId] = useState<string | null>(null);
  const [checkingStatusDeviceId, setCheckingStatusDeviceId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [devicePowerStates, setDevicePowerStates] = useState<Record<string, boolean | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: devices, isLoading } = useDevices();
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const deleteMutation = useDeleteDevice();
  const controlMutation = useControlDevice();
  const importMutation = useImportDevices();
  const checkStatusMutation = useCheckDeviceStatus();
  const importFromCloudMutation = useImportDevicesFromCloud();

  const handleControl = async (deviceId: string, action: 'on' | 'off' | 'toggle') => {
    setControllingDeviceId(deviceId);
    try {
      const result = await controlMutation.mutateAsync({ id: deviceId, action });
      // Update power state from control result
      if (result.state) {
        setDevicePowerStates(prev => ({ ...prev, [deviceId]: result.state.power }));
      }
    } finally {
      setControllingDeviceId(null);
    }
  };

  const handleCheckStatus = async (deviceId: string) => {
    setCheckingStatusDeviceId(deviceId);
    try {
      const result = await checkStatusMutation.mutateAsync(deviceId);
      // Update power state from status check
      if (result.state) {
        setDevicePowerStates(prev => ({ ...prev, [deviceId]: result.state.power }));
      }
    } catch {
      // Error is handled by the mutation, status will be updated to offline
      setDevicePowerStates(prev => ({ ...prev, [deviceId]: null }));
    } finally {
      setCheckingStatusDeviceId(null);
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (confirm('Are you sure you want to delete this device?')) {
      await deleteMutation.mutateAsync(deviceId);
    }
  };

  const handleCreateDevice = async (input: CreateDeviceInput) => {
    await createMutation.mutateAsync(input);
    setIsModalOpen(false);
  };

  const handleUpdateDevice = async (id: string, input: UpdateDeviceInput) => {
    await updateMutation.mutateAsync({ id, input });
    setEditingDevice(null);
  };

  const handleImportFromCloud = async () => {
    try {
      const result = await importFromCloudMutation.mutateAsync();
      setImportResult({
        message: `Imported ${result.imported.length} devices, skipped ${result.skipped.length} existing.`,
        type: 'success'
      });
      setTimeout(() => setImportResult(null), 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import from Tuya Cloud';
      setImportResult({ message, type: 'error' });
      setTimeout(() => setImportResult(null), 5000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Handle both formats: { result: [...] } or just [...]
      const devices = json.result || json;

      if (!Array.isArray(devices)) {
        throw new Error('Invalid file format. Expected an array of devices.');
      }

      const result = await importMutation.mutateAsync(devices);
      setImportResult({ message: result.message, type: 'success' });

      // Clear after 5 seconds
      setTimeout(() => setImportResult(null), 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import';
      setImportResult({ message, type: 'error' });
      setTimeout(() => setImportResult(null), 5000);
    }

    // Reset file input
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const hasDevices = devices && devices.length > 0;

  return (
    <div className="space-y-6">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Devices</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your smart home devices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportFromCloud}
            disabled={importFromCloudMutation.isPending}
            className="btn btn-secondary flex items-center gap-2"
            title="Import devices from your Tuya Cloud account"
          >
            {importFromCloudMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            Import from Cloud
          </button>
          <button
            onClick={handleImportClick}
            disabled={importMutation.isPending}
            className="btn btn-secondary flex items-center gap-2"
            title="Import devices from a JSON file"
          >
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import JSON
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      </div>

      {/* Import result notification */}
      {importResult && (
        <div className={`p-4 rounded-lg ${importResult.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
          {importResult.message}
        </div>
      )}

      {hasDevices ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device: Device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onControl={(action) => handleControl(device.id, action)}
              onDelete={() => handleDelete(device.id)}
              onEdit={() => setEditingDevice(device)}
              onCheckStatus={() => handleCheckStatus(device.id)}
              isControlling={controllingDeviceId === device.id}
              isCheckingStatus={checkingStatusDeviceId === device.id}
              powerState={devicePowerStates[device.id] ?? null}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Plug className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Devices Yet</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
            Add your Tuya smart devices to control them based on electricity prices.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={handleImportFromCloud}
              disabled={importFromCloudMutation.isPending}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              {importFromCloudMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              Import from Tuya Cloud
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </button>
          </div>
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-left">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">What you'll need:</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>1. Create a Tuya IoT Platform developer account at <a href="https://iot.tuya.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">iot.tuya.com</a></li>
              <li>2. Create a Cloud project and link your Tuya/Smart Life app</li>
              <li>3. Add your Tuya credentials in Settings</li>
              <li>4. Click "Import from Tuya Cloud" to import all your devices</li>
            </ul>
          </div>
        </div>
      )}

      <AddDeviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateDevice}
        isSubmitting={createMutation.isPending}
      />

      <EditDeviceModal
        device={editingDevice}
        isOpen={editingDevice !== null}
        onClose={() => setEditingDevice(null)}
        onSubmit={handleUpdateDevice}
        isSubmitting={updateMutation.isPending}
      />

      {createMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {createMutation.error.message}
        </div>
      )}

      {controlMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {controlMutation.error.message}
        </div>
      )}

      {updateMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {updateMutation.error.message}
        </div>
      )}
    </div>
  );
}
