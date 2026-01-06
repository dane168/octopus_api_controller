import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as pricesApi from '../api/prices';

export function useTodayPrices() {
  return useQuery({
    queryKey: ['prices', 'today'],
    queryFn: () => pricesApi.getTodayPrices(),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 60 * 1000, // Consider fresh for 1 minute
  });
}

export function useCurrentPrice() {
  return useQuery({
    queryKey: ['prices', 'current'],
    queryFn: () => pricesApi.getCurrentPrice(),
    refetchInterval: 60 * 1000, // Refetch every minute
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
  });
}

export function useCheapestHours(hours: number, options?: {
  from?: string;
  to?: string;
  consecutive?: boolean;
}) {
  return useQuery({
    queryKey: ['prices', 'cheapest', hours, options],
    queryFn: () => pricesApi.getCheapestHours({ hours, ...options }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

export function useRefreshPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pricesApi.refreshPrices,
    onSuccess: () => {
      // Invalidate all price queries after refresh
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });
}
