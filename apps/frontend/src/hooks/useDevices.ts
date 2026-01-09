import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as devicesApi from '../api/devices';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceAction, DeviceConfig } from '@octopus-controller/shared';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getDevices(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  });
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id,
  });
}

export function useDeviceState(id: string, enabled = true) {
  return useQuery({
    queryKey: ['devices', id, 'state'],
    queryFn: () => devicesApi.getDeviceState(id),
    enabled: !!id && enabled,
    refetchInterval: 60 * 1000, // Refetch state every minute
    staleTime: 30 * 1000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDeviceInput) => devicesApi.createDevice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeviceInput }) =>
      devicesApi.updateDevice(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => devicesApi.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useControlDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: DeviceAction }) =>
      devicesApi.controlDevice(id, action),
    onSuccess: (_data, variables) => {
      // Invalidate both the device and its state
      queryClient.invalidateQueries({ queryKey: ['devices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (config: DeviceConfig) => devicesApi.testConnection(config),
  });
}

interface TuyaDevice {
  id: string;
  custom_name?: string;
  name: string;
  local_key: string;
  ip?: string;
  category: string;
  is_online?: boolean;
}

export function useImportDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (devices: TuyaDevice[]) => devicesApi.importDevices(devices),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useCheckDeviceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => devicesApi.getDeviceState(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
