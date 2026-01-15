import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as schedulesApi from '../api/schedules';
import type { CreateScheduleInput, UpdateScheduleInput } from '@octopus-controller/shared';

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.getSchedules(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  });
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: ['schedules', id],
    queryFn: () => schedulesApi.getSchedule(id),
    enabled: !!id,
  });
}

export function useScheduleLogs(id: string, limit?: number) {
  return useQuery({
    queryKey: ['schedules', id, 'logs', limit],
    queryFn: () => schedulesApi.getScheduleLogs(id, limit),
    enabled: !!id,
    refetchInterval: 60 * 1000, // Refetch logs every minute
    staleTime: 30 * 1000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduleInput) => schedulesApi.createSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScheduleInput }) =>
      schedulesApi.updateSchedule(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => schedulesApi.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useToggleSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => schedulesApi.toggleSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useAllLogs(limit?: number) {
  return useQuery({
    queryKey: ['logs', 'all', limit],
    queryFn: () => schedulesApi.getAllLogs(limit),
    refetchInterval: 30 * 1000, // Refetch logs every 30 seconds
    staleTime: 15 * 1000,
  });
}

export function useEffectiveSchedules() {
  return useQuery({
    queryKey: ['schedules', 'effective'],
    queryFn: () => schedulesApi.getEffectiveSchedules(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  });
}

export function useConflicts() {
  return useQuery({
    queryKey: ['schedules', 'conflicts'],
    queryFn: () => schedulesApi.getConflicts(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  });
}
