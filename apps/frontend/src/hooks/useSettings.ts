import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '../api/settings';
import type { AppSettings } from '@octopus-controller/shared';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: settingsApi.getRegions,
    staleTime: Infinity, // Regions don't change
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<AppSettings>) => settingsApi.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Also invalidate prices since they depend on region
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });
}
