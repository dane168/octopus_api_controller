import { RefreshCw } from 'lucide-react';
import { useTodayPrices, useCurrentPrice, useRefreshPrices } from '../hooks/usePrices';
import { useSettings } from '../hooks/useSettings';
import { PriceChart } from '../components/prices/PriceChart';
import { CurrentPrice } from '../components/prices/CurrentPrice';

export function Dashboard() {
  const { data: prices, isLoading: pricesLoading } = useTodayPrices();
  const { data: currentPrice, isLoading: currentLoading } = useCurrentPrice();
  const { data: settings } = useSettings();
  const refreshMutation = useRefreshPrices();

  // Find next price
  const now = new Date();
  const nextPrice = prices?.find((p) => new Date(p.validFrom) > now);

  // Calculate stats
  const stats = prices
    ? {
        min: Math.min(...prices.map((p) => p.valueIncVat)),
        max: Math.max(...prices.map((p) => p.valueIncVat)),
        avg: prices.reduce((sum, p) => sum + p.valueIncVat, 0) / prices.length,
      }
    : null;

  const needsSetup = !settings?.region;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            {settings?.region
              ? `Region ${settings.region} - Octopus Agile`
              : 'Configure your region in Settings'}
          </p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending || needsSetup}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Setup prompt */}
      {needsSetup && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <h2 className="font-medium text-blue-900">Welcome!</h2>
          <p className="text-blue-700 mt-1">
            To get started, please configure your electricity region in Settings.
          </p>
          <a href="/settings" className="btn btn-primary mt-4 inline-block">
            Go to Settings
          </a>
        </div>
      )}

      {/* Current price card */}
      <CurrentPrice
        price={currentPrice || null}
        nextPrice={nextPrice}
        isLoading={currentLoading}
      />

      {/* Price chart */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Prices</h2>
        {pricesLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : prices && prices.length > 0 ? (
          <PriceChart prices={prices} currentTime={now} />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No price data available. Try refreshing.
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Min</p>
            <p className="text-xl font-bold text-green-600">{stats.min.toFixed(1)}p</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Avg</p>
            <p className="text-xl font-bold text-gray-900">{stats.avg.toFixed(1)}p</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Max</p>
            <p className="text-xl font-bold text-red-600">{stats.max.toFixed(1)}p</p>
          </div>
        </div>
      )}
    </div>
  );
}
