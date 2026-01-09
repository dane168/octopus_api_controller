import { api } from './client';
import type { Price } from '@octopus-controller/shared';

interface PricesResponse {
  prices: Price[];
}

interface PriceResponse {
  price: Price;
}

interface RefreshResponse {
  message: string;
  count: number;
  inserted: number;
}

export async function getPrices(params?: {
  from?: string;
  to?: string;
  region?: string;
}): Promise<Price[]> {
  const { data } = await api.get<PricesResponse>('/prices', { params });
  return data.prices;
}

export async function getCurrentPrice(region?: string): Promise<Price> {
  const { data } = await api.get<PriceResponse>('/prices/current', {
    params: region ? { region } : undefined,
  });
  return data.price;
}

export async function getTodayPrices(region?: string): Promise<Price[]> {
  const { data } = await api.get<PricesResponse>('/prices/today', {
    params: region ? { region } : undefined,
  });
  return data.prices;
}

export async function getNext24HoursPrices(region?: string): Promise<Price[]> {
  const now = new Date();
  // Round down to the current half-hour slot to include the current window
  const currentSlotStart = new Date(now);
  currentSlotStart.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);

  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data } = await api.get<PricesResponse>('/prices', {
    params: {
      from: currentSlotStart.toISOString(),
      to: in24Hours.toISOString(),
      ...(region ? { region } : {}),
    },
  });
  return data.prices;
}

export async function getCheapestHours(params: {
  hours: number;
  from?: string;
  to?: string;
  consecutive?: boolean;
}): Promise<Price[]> {
  const { data } = await api.get<PricesResponse>('/prices/cheapest', { params });
  return data.prices;
}

export async function refreshPrices(): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>('/prices/refresh');
  return data;
}
