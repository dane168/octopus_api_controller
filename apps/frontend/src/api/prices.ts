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
