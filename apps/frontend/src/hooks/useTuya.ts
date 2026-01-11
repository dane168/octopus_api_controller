import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTuyaCredentials,
  saveTuyaCredentials,
  deleteTuyaCredentials,
  testTuyaCredentials,
  getTuyaEndpoints,
  getTuyaCloudDevices,
  getTuyaSpaces,
  getSpaceDevices,
  importDevicesFromSpace,
  importDevicesFromCloud,
  type TuyaCredentialsInput,
} from '../api/tuya';

export function useTuyaCredentials() {
  return useQuery({
    queryKey: ['tuya', 'credentials'],
    queryFn: getTuyaCredentials,
  });
}

export function useTuyaEndpoints() {
  return useQuery({
    queryKey: ['tuya', 'endpoints'],
    queryFn: getTuyaEndpoints,
    staleTime: Infinity, // Endpoints don't change
  });
}

export function useTuyaCloudDevices() {
  return useQuery({
    queryKey: ['tuya', 'cloud-devices'],
    queryFn: getTuyaCloudDevices,
    enabled: false, // Only fetch when explicitly requested
  });
}

export function useTuyaSpaces(enabled = true) {
  return useQuery({
    queryKey: ['tuya', 'spaces'],
    queryFn: getTuyaSpaces,
    enabled,
  });
}

export function useSpaceDevices(spaceId: string | null) {
  return useQuery({
    queryKey: ['tuya', 'space-devices', spaceId],
    queryFn: () => getSpaceDevices(spaceId!),
    enabled: !!spaceId,
  });
}

export function useSaveTuyaCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TuyaCredentialsInput) => saveTuyaCredentials(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuya', 'credentials'] });
    },
  });
}

export function useDeleteTuyaCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteTuyaCredentials(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuya', 'credentials'] });
    },
  });
}

export function useTestTuyaCredentials() {
  return useMutation({
    mutationFn: (input: TuyaCredentialsInput) => testTuyaCredentials(input),
  });
}

export function useImportDevicesFromSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (spaceId: string) => importDevicesFromSpace(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useImportDevicesFromCloud() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => importDevicesFromCloud(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
