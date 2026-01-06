import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { Price } from '@octopus-controller/shared';

interface PriceChartProps {
  prices: Price[];
  currentTime?: Date;
}

function getBarColor(price: number): string {
  if (price < 0) return '#22c55e';      // Green - negative (plunge pricing!)
  if (price < 10) return '#22c55e';     // Green - very cheap
  if (price < 15) return '#84cc16';     // Lime - cheap
  if (price < 20) return '#eab308';     // Yellow - normal
  if (price < 25) return '#f97316';     // Orange - expensive
  return '#ef4444';                      // Red - very expensive
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(value: number): string {
  return `${value.toFixed(1)}p`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Price }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const price = payload[0].payload;
  const time = formatTime(price.validFrom);
  const endTime = formatTime(price.validTo);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <p className="font-medium text-gray-900">{time} - {endTime}</p>
      <p className="text-2xl font-bold" style={{ color: getBarColor(price.valueIncVat) }}>
        {price.valueIncVat.toFixed(2)}p/kWh
      </p>
      <p className="text-xs text-gray-500">
        Ex VAT: {price.valueExcVat.toFixed(2)}p
      </p>
    </div>
  );
}

export function PriceChart({ prices, currentTime = new Date() }: PriceChartProps) {
  // Find current price index
  const currentIndex = prices.findIndex((p) => {
    const from = new Date(p.validFrom);
    const to = new Date(p.validTo);
    return currentTime >= from && currentTime < to;
  });

  return (
    <div className="w-full h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={prices} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <XAxis
            dataKey="validFrom"
            tickFormatter={formatTime}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={formatPrice}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Reference line at 0 for negative prices */}
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          <Bar dataKey="valueIncVat" radius={[2, 2, 0, 0]}>
            {prices.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry.valueIncVat)}
                opacity={index === currentIndex ? 1 : 0.7}
                stroke={index === currentIndex ? '#1f2937' : 'transparent'}
                strokeWidth={index === currentIndex ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
