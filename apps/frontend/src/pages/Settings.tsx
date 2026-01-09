import { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useSettings, useRegions, useUpdateSettings } from '../hooks/useSettings';
import { useRefreshPrices } from '../hooks/usePrices';

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const { data: regions } = useRegions();
  const updateMutation = useUpdateSettings();
  const refreshPrices = useRefreshPrices();

  const [region, setRegion] = useState('');
  const [octopusApiKey, setOctopusApiKey] = useState('');
  const [octopusMpan, setOctopusMpan] = useState('');
  const [octopusSerial, setOctopusSerial] = useState('');
  const [saved, setSaved] = useState(false);

  // Track if a key is stored (masked) and show it in the UI
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [apiKeyRaw, setApiKeyRaw] = useState<string | null>(null);
  useEffect(() => {
    if (settings?.region) setRegion(settings.region);
    if (settings?.octopusApiKey) {
      let raw = settings.octopusApiKey;
      if (raw.startsWith('***')) {
        // Can't know real length, so just show as is
        setApiKeyMasked(raw);
        setApiKeyRaw(null);
        setOctopusApiKey('');
      } else {
        setApiKeyRaw(raw);
        if (raw.length > 4) {
          setApiKeyMasked('*'.repeat(raw.length - 4) + raw.slice(-4));
        } else {
          setApiKeyMasked(raw);
        }
        setOctopusApiKey(raw);
      }
    } else {
      setApiKeyMasked(null);
      setApiKeyRaw(null);
      setOctopusApiKey('');
    }
    if (settings?.octopusMpan) setOctopusMpan(settings.octopusMpan);
    if (settings?.octopusSerial) setOctopusSerial(settings.octopusSerial);
  }, [settings]);

  const handleSave = async () => {
    if (!region) return;
    const updates: any = { region, octopusMpan, octopusSerial };
    // Only send API key if user entered a new value (not blank)
    if (octopusApiKey) {
      updates.octopusApiKey = octopusApiKey;
    }
    await updateMutation.mutateAsync(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refreshPrices.mutate();
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

      {/* Region Selection */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Electricity Region</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select your electricity region to get accurate Agile tariff prices.
          You can find your region on your electricity bill or by checking your postcode.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="region" className="label">
              Region
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
          </div>

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
              'Save Region'
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

      {/* Octopus API Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Octopus API Settings</h2>
        <div className="space-y-4">
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
            <p className="text-xs text-gray-400 mt-1">Required for consumption data and some price endpoints.</p>
          </div>
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

      {/* About */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
        <p className="text-sm text-gray-500">
          Energy Controller v1.0.0
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Local smart home energy management with Octopus Agile tariff integration.
        </p>
      </div>
    </div>
  );
}
