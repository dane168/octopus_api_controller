import { useNext24HoursPrices, useCheapestHours } from '../hooks/usePrices';
import { PriceChart } from '../components/prices/PriceChart';
import { Clock, Zap } from 'lucide-react';
import type { Price } from '@octopus-controller/shared';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PriceSlot({ price, isCheapest }: { price: Price; isCheapest: boolean }) {
  const getPriceColor = (p: number) => {
    if (p < 0) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
    if (p < 10) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
    if (p < 15) return 'text-lime-600 bg-lime-50 dark:text-lime-400 dark:bg-lime-900/30';
    if (p < 20) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30';
    if (p < 25) return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30';
    return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
  };

  const now = new Date();
  const from = new Date(price.validFrom);
  const to = new Date(price.validTo);
  const isCurrent = now >= from && now < to;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isCurrent
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
          : isCheapest
          ? 'border-green-300 bg-green-50/50 dark:bg-green-900/20 dark:border-green-600'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-medium dark:text-gray-200">
          {formatTime(price.validFrom)} - {formatTime(price.validTo)}
        </span>
        {isCurrent && (
          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">NOW</span>
        )}
        {isCheapest && !isCurrent && (
          <Zap className="w-4 h-4 text-green-500 dark:text-green-400" />
        )}
      </div>
      <span className={`font-bold px-3 py-1 rounded ${getPriceColor(price.valueIncVat)}`}>
        {price.valueIncVat.toFixed(2)}p
      </span>
    </div>
  );
}

export function Prices() {
  const { data: prices, isLoading } = useNext24HoursPrices();
  const { data: cheapestSlots } = useCheapestHours(3); // Cheapest 3 hours

  const cheapestIds = new Set(cheapestSlots?.map((p) => p.validFrom) || []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Prices</h1>
        <p className="text-gray-500 dark:text-gray-400">Next 24 hours of half-hourly electricity prices</p>
      </div>

      {/* Chart */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Price Chart</h2>
        {prices && prices.length > 0 ? (
          <PriceChart prices={prices} cheapestSlots={cheapestIds} />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No price data available
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm dark:text-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span>&lt;10p (Cheap)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-lime-500"></div>
          <span>10-15p</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>15-20p</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500"></div>
          <span>20-25p</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>&gt;25p (Expensive)</span>
        </div>
      </div>

      {/* Time slots */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">All Time Slots</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {prices?.map((price) => (
            <PriceSlot
              key={price.validFrom}
              price={price}
              isCheapest={cheapestIds.has(price.validFrom)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
