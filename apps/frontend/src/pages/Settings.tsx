import { useState, useEffect } from 'react';
import { Check, AlertCircle, Wifi, WifiOff, Cloud, Trash2, Download, Home, RefreshCw } from 'lucide-react';
import { useSettings, useRegions, useUpdateSettings } from '../hooks/useSettings';
import { useRefreshPrices } from '../hooks/usePrices';
import {
  useTuyaCredentials,
  useTuyaEndpoints,
  useSaveTuyaCredentials,
  useDeleteTuyaCredentials,
  useTestTuyaCredentials,
  useTuyaSpaces,
  useSpaceDevices,
  useImportDevicesFromSpace,
} from '../hooks/useTuya';
import type { TuyaEndpoint } from '../api/tuya';
import type { TuyaSpace } from '@octopus-controller/shared';

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const { data: regions } = useRegions();
  const updateMutation = useUpdateSettings();
  const refreshPrices = useRefreshPrices();

  // Tuya hooks
  const { data: tuyaCredentials } = useTuyaCredentials();
  const { data: tuyaEndpoints } = useTuyaEndpoints();
  const saveTuyaMutation = useSaveTuyaCredentials();
  const deleteTuyaMutation = useDeleteTuyaCredentials();
  const testTuyaMutation = useTestTuyaCredentials();

  // Space-based device import hooks
  const { data: tuyaSpaces, isLoading: spacesLoading, refetch: refetchSpaces } = useTuyaSpaces(!!tuyaCredentials?.configured);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const { data: spaceDevices, isLoading: devicesLoading } = useSpaceDevices(selectedSpaceId);
  const importDevicesMutation = useImportDevicesFromSpace();

  const [region, setRegion] = useState('');
  const [octopusApiKey, setOctopusApiKey] = useState('');
  const [octopusMpan, setOctopusMpan] = useState('');
  const [octopusSerial, setOctopusSerial] = useState('');
  const [saved, setSaved] = useState(false);

  // Tuya form state
  const [tuyaAccessId, setTuyaAccessId] = useState('');
  const [tuyaAccessSecret, setTuyaAccessSecret] = useState('');
  const [tuyaEndpoint, setTuyaEndpoint] = useState('https://openapi.tuyaeu.com');
  const [tuyaSaved, setTuyaSaved] = useState(false);
  const [tuyaTestResult, setTuyaTestResult] = useState<boolean | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Track if a key is stored (masked) and show it in the UI
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.region) setRegion(settings.region);
    if (settings?.octopusApiKey) {
      const raw = settings.octopusApiKey;
      if (raw.startsWith('***')) {
        setApiKeyMasked(raw);
        setOctopusApiKey('');
      } else {
        if (raw.length > 4) {
          setApiKeyMasked('*'.repeat(raw.length - 4) + raw.slice(-4));
        } else {
          setApiKeyMasked(raw);
        }
        setOctopusApiKey(raw);
      }
    } else {
      setApiKeyMasked(null);
      setOctopusApiKey('');
    }
    if (settings?.octopusMpan) setOctopusMpan(settings.octopusMpan);
    if (settings?.octopusSerial) setOctopusSerial(settings.octopusSerial);
  }, [settings]);

  // Update Tuya form when credentials are loaded
  useEffect(() => {
    if (tuyaCredentials?.configured) {
      setTuyaAccessId(tuyaCredentials.accessId || '');
      setTuyaEndpoint(tuyaCredentials.endpoint || 'https://openapi.tuyaeu.com');
    }
  }, [tuyaCredentials]);

  // Auto-select first space if only one available
  useEffect(() => {
    if (tuyaSpaces && tuyaSpaces.length === 1 && !selectedSpaceId) {
      setSelectedSpaceId(tuyaSpaces[0].id);
    }
  }, [tuyaSpaces, selectedSpaceId]);

  const handleSave = async () => {
    if (!region) return;
    const updates: any = { region, octopusMpan, octopusSerial };
    if (octopusApiKey) {
      updates.octopusApiKey = octopusApiKey;
    }
    await updateMutation.mutateAsync(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refreshPrices.mutate();
  };

  const handleTestTuya = async () => {
    if (!tuyaAccessId || !tuyaAccessSecret) return;
    setTuyaTestResult(null);
    try {
      const result = await testTuyaMutation.mutateAsync({
        accessId: tuyaAccessId,
        accessSecret: tuyaAccessSecret,
        endpoint: tuyaEndpoint,
      });
      setTuyaTestResult(result);
    } catch {
      setTuyaTestResult(false);
    }
  };

  const handleSaveTuya = async () => {
    if (!tuyaAccessId || !tuyaAccessSecret) return;
    try {
      await saveTuyaMutation.mutateAsync({
        accessId: tuyaAccessId,
        accessSecret: tuyaAccessSecret,
        endpoint: tuyaEndpoint,
      });
      setTuyaSaved(true);
      setTuyaAccessSecret(''); // Clear secret after save
      setTimeout(() => setTuyaSaved(false), 2000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save Tuya credentials');
    }
  };

  const handleDeleteTuya = async () => {
    if (!confirm('Are you sure you want to delete your Tuya credentials?')) return;
    try {
      await deleteTuyaMutation.mutateAsync();
      setTuyaAccessId('');
      setTuyaAccessSecret('');
      setTuyaEndpoint('https://openapi.tuyaeu.com');
      setSelectedSpaceId(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete Tuya credentials');
    }
  };

  const handleImportDevices = async () => {
    if (!selectedSpaceId) return;
    try {
      const result = await importDevicesMutation.mutateAsync(selectedSpaceId);
      setImportResult({ imported: result.imported.length, skipped: result.skipped.length });
      setTimeout(() => setImportResult(null), 5000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to import devices');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure your energy controller</p>
      </div>

      {/* Tuya Cloud API Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Tuya Cloud API</h2>
          {tuyaCredentials?.configured ? (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              <WifiOff className="w-3 h-3" />
              Not configured
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Connect your Tuya Smart Home account to control your devices.
          You'll need to create an IoT project at{' '}
          <a href="https://iot.tuya.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            iot.tuya.com
          </a>
          {' '}and link your devices.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="tuyaAccessId" className="label">
              Access ID <span className="text-red-500">*</span>
            </label>
            <input
              id="tuyaAccessId"
              type="text"
              className="input"
              value={tuyaAccessId}
              onChange={(e) => setTuyaAccessId(e.target.value)}
              placeholder="Your Tuya Access ID"
            />
          </div>

          <div>
            <label htmlFor="tuyaAccessSecret" className="label">
              Access Secret <span className="text-red-500">*</span>
            </label>
            <input
              id="tuyaAccessSecret"
              type="password"
              className="input"
              value={tuyaAccessSecret}
              onChange={(e) => setTuyaAccessSecret(e.target.value)}
              placeholder={tuyaCredentials?.configured ? '••••••••' : 'Your Tuya Access Secret'}
            />
            {tuyaCredentials?.configured && tuyaCredentials.accessSecretMasked && !tuyaAccessSecret && (
              <p className="text-xs text-gray-400 mt-1">
                Secret saved: <span className="font-mono">{tuyaCredentials.accessSecretMasked}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="tuyaEndpoint" className="label">
              Region <span className="text-red-500">*</span>
            </label>
            <select
              id="tuyaEndpoint"
              className="input"
              value={tuyaEndpoint}
              onChange={(e) => setTuyaEndpoint(e.target.value)}
            >
              {tuyaEndpoints?.map((ep: TuyaEndpoint) => (
                <option key={ep.region} value={ep.url}>
                  {ep.name}
                </option>
              )) || (
                <>
                  <option value="https://openapi.tuyaeu.com">Europe</option>
                  <option value="https://openapi.tuyaus.com">United States</option>
                  <option value="https://openapi.tuyacn.com">China</option>
                  <option value="https://openapi.tuyain.com">India</option>
                  <option value="https://openapi.tuyasg.com">ASEAN (Singapore)</option>
                </>
              )}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Must match your Tuya IoT project's data center region.
            </p>
          </div>

          {tuyaTestResult !== null && (
            <div className={`p-3 rounded-lg ${tuyaTestResult ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {tuyaTestResult ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Connection successful!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Connection failed. Please check your credentials and region.
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestTuya}
              disabled={!tuyaAccessId || !tuyaAccessSecret || testTuyaMutation.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              {testTuyaMutation.isPending ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              onClick={handleSaveTuya}
              disabled={!tuyaAccessId || !tuyaAccessSecret || saveTuyaMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {tuyaSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : saveTuyaMutation.isPending ? (
                'Saving...'
              ) : (
                'Save Credentials'
              )}
            </button>

            {tuyaCredentials?.configured && (
              <button
                onClick={handleDeleteTuya}
                disabled={deleteTuyaMutation.isPending}
                className="btn btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleteTuyaMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>

          {/* Space-based Device Import */}
          {tuyaCredentials?.configured && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-medium text-gray-700">Import Devices from Space</h3>
                </div>
                <button
                  onClick={() => refetchSpaces()}
                  disabled={spacesLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${spacesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Select a Tuya space (home) to view and import devices from.
              </p>

              {/* Space Selection */}
              <div className="mb-3">
                <label htmlFor="spaceSelect" className="label">
                  Select Space
                </label>
                <select
                  id="spaceSelect"
                  className="input"
                  value={selectedSpaceId || ''}
                  onChange={(e) => setSelectedSpaceId(e.target.value || null)}
                  disabled={spacesLoading || !tuyaSpaces?.length}
                >
                  <option value="">
                    {spacesLoading ? 'Loading spaces...' :
                     !tuyaSpaces?.length ? 'No spaces found' :
                     'Select a space...'}
                  </option>
                  {tuyaSpaces?.map((space: TuyaSpace) => (
                    <option key={space.id} value={space.id}>
                      {space.name || `Space ${space.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Device Preview */}
              {selectedSpaceId && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      Devices in this space:
                    </span>
                    {devicesLoading && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                  </div>

                  {spaceDevices && spaceDevices.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <ul className="space-y-1">
                        {spaceDevices.map((device) => (
                          <li key={device.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {device.custom_name || device.name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              device.is_online
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              {device.is_online ? 'Online' : 'Offline'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : !devicesLoading && (
                    <p className="text-xs text-gray-400 italic">No devices found in this space.</p>
                  )}
                </div>
              )}

              {/* Import Button */}
              <button
                onClick={handleImportDevices}
                disabled={!selectedSpaceId || importDevicesMutation.isPending || devicesLoading}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {importDevicesMutation.isPending ? 'Importing...' : 'Import Devices from Selected Space'}
              </button>

              {importResult && (
                <p className="text-sm text-green-600 mt-2">
                  Imported {importResult.imported} devices, skipped {importResult.skipped} existing.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Octopus Energy Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Octopus Energy Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure your Octopus Energy API credentials and electricity region.
        </p>

        <div className="space-y-4">
          {/* Region Selection */}
          <div>
            <label htmlFor="region" className="label">
              Electricity Region <span className="text-red-500">*</span>
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="input"
            >
              <option value="">Select a region...</option>
              {regions?.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              You can find your region on your electricity bill or by checking your postcode.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="octopusApiKey" className="label">API Key <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                id="octopusApiKey"
                type="text"
                className="input"
                value={octopusApiKey}
                onChange={e => setOctopusApiKey(e.target.value)}
                placeholder={apiKeyMasked ? apiKeyMasked : 'sk_live_...'}
                required
                autoComplete="off"
              />
              {apiKeyMasked && !octopusApiKey && (
                <span className="text-xs text-gray-500">(saved)</span>
              )}
            </div>
            {apiKeyMasked && !octopusApiKey && (
              <p className="text-xs text-gray-400 mt-1">API key is saved: <span className="font-mono">{apiKeyMasked}</span></p>
            )}
            <p className="text-xs text-gray-400 mt-1">Required for consumption data and price endpoints.</p>
          </div>

          {/* MPAN */}
          <div>
            <label htmlFor="octopusMpan" className="label">MPAN</label>
            <input
              id="octopusMpan"
              type="text"
              className="input"
              value={octopusMpan}
              onChange={e => setOctopusMpan(e.target.value)}
              placeholder="e.g. 1300053174403"
            />
          </div>

          {/* Meter Serial */}
          <div>
            <label htmlFor="octopusSerial" className="label">Meter Serial</label>
            <input
              id="octopusSerial"
              type="text"
              className="input"
              value={octopusSerial}
              onChange={e => setOctopusSerial(e.target.value)}
              placeholder="e.g. 18L2269348"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!region || updateMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : updateMutation.isPending ? (
              'Saving...'
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Agile Tariff</h3>
            <p className="text-sm text-blue-700 mt-1">
              Octopus Energy's Agile tariff prices change every 30 minutes based on wholesale
              electricity prices. New prices are released daily at 4pm for the period 11pm-11pm.
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Prices can go negative during high renewable generation</li>
              <li>• Prices are capped at 100p/kWh</li>
              <li>• Peak prices typically occur between 4pm-7pm</li>
            </ul>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
        <p className="text-sm text-gray-500">
          Energy Controller v1.0.0
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Smart home energy management with Octopus Agile tariff integration and Tuya Cloud control.
        </p>
      </div>
    </div>
  );
}
