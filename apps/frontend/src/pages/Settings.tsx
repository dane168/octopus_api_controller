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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.region) {
      setRegion(settings.region);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!region) return;

    await updateMutation.mutateAsync({ region });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Refresh prices with new region
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

      {/* API Settings (future) */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Octopus API (Optional)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add your Octopus API key to access your consumption data. This is optional -
          price data works without authentication.
        </p>
        <p className="text-sm text-gray-400 italic">
          Consumption tracking will be added in a future update.
        </p>
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
