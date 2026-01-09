import { api } from './client';
import type {
  ScheduleWithDevices,
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleLog,
  EnrichedScheduleLog,
} from '@octopus-controller/shared';

interface SchedulesResponse {
  schedules: ScheduleWithDevices[];
}

interface ScheduleResponse {
  schedule: Schedule;
}

interface ScheduleLogsResponse {
  logs: ScheduleLog[];
}

interface AllLogsResponse {
  logs: EnrichedScheduleLog[];
}

export async function getSchedules(): Promise<ScheduleWithDevices[]> {
  const { data } = await api.get<SchedulesResponse>('/schedules');
  return data.schedules;
}

export async function getSchedule(id: string): Promise<Schedule> {
  const { data } = await api.get<ScheduleResponse>(`/schedules/${id}`);
  return data.schedule;
}

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const { data } = await api.post<ScheduleResponse>('/schedules', input);
  return data.schedule;
}

export async function updateSchedule(id: string, input: UpdateScheduleInput): Promise<Schedule> {
  const { data } = await api.put<ScheduleResponse>(`/schedules/${id}`, input);
  return data.schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  await api.delete(`/schedules/${id}`);
}

export async function toggleSchedule(id: string): Promise<Schedule> {
  const { data } = await api.post<ScheduleResponse>(`/schedules/${id}/toggle`);
  return data.schedule;
}

export async function getScheduleLogs(id: string, limit?: number): Promise<ScheduleLog[]> {
  const { data } = await api.get<ScheduleLogsResponse>(`/schedules/${id}/logs`, {
    params: limit ? { limit } : undefined,
  });
  return data.logs;
}

export async function getAllLogs(limit?: number): Promise<EnrichedScheduleLog[]> {
  const { data } = await api.get<AllLogsResponse>('/schedules/logs/all', {
    params: limit ? { limit } : undefined,
  });
  return data.logs;
}
