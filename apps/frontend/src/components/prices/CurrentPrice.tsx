import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Price } from '@octopus-controller/shared';

interface CurrentPriceProps {
  price: Price | null;
  nextPrice?: Price | null;
  isLoading?: boolean;
}

function getPriceColor(price: number): string {
  if (price < 0) return 'text-green-600';
  if (price < 10) return 'text-green-600';
  if (price < 15) return 'text-lime-600';
  if (price < 20) return 'text-yellow-600';
  if (price < 25) return 'text-orange-600';
  return 'text-red-600';
}

function getPriceBg(price: number): string {
  if (price < 0) return 'bg-green-50';
  if (price < 10) return 'bg-green-50';
  if (price < 15) return 'bg-lime-50';
  if (price < 20) return 'bg-yellow-50';
  if (price < 25) return 'bg-orange-50';
  return 'bg-red-50';
}

function getPriceLabel(price: number): string {
  if (price < 0) return 'Negative!';
  if (price < 10) return 'Very Cheap';
  if (price < 15) return 'Cheap';
  if (price < 20) return 'Normal';
  if (price < 25) return 'Expensive';
  return 'Very Expensive';
}

function formatTimeRange(from: string, to: string): string {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatTime(from)} - ${formatTime(to)}`;
}

export function CurrentPrice({ price, nextPrice, isLoading }: CurrentPriceProps) {
  if (isLoading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="h-12 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (!price) {
    return (
      <div className="card p-6">
        <p className="text-gray-500">No price data available</p>
        <p className="text-sm text-gray-400 mt-1">Try refreshing prices</p>
      </div>
    );
  }

  const priceValue = price.valueIncVat;
  const trend = nextPrice
    ? nextPrice.valueIncVat > priceValue
      ? 'up'
      : nextPrice.valueIncVat < priceValue
      ? 'down'
      : 'same'
    : null;

  return (
    <div className={`card p-6 ${getPriceBg(priceValue)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-gray-600">Current Price</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getPriceColor(priceValue)} bg-white/50`}>
          {getPriceLabel(priceValue)}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-4xl md:text-5xl font-bold ${getPriceColor(priceValue)}`}>
          {priceValue.toFixed(2)}
        </span>
        <span className="text-lg text-gray-600">p/kWh</span>
      </div>

      <p className="text-sm text-gray-500 mt-2">
        {formatTimeRange(price.validFrom, price.validTo)}
      </p>

      {nextPrice && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200/50">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
          {trend === 'same' && <Minus className="w-4 h-4 text-gray-500" />}
          <span className="text-sm text-gray-600">
            Next: <span className={getPriceColor(nextPrice.valueIncVat)}>
              {nextPrice.valueIncVat.toFixed(2)}p
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
