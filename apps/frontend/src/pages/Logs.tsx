import { useState } from 'react';
import { History, Loader2, CheckCircle, XCircle, Filter, RefreshCw } from 'lucide-react';
import { useAllLogs } from '../hooks/useSchedules';
import type { EnrichedScheduleLog } from '@octopus-controller/shared';

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (isToday) {
    return `Today ${time}`;
  } else if (isYesterday) {
    return `Yesterday ${time}`;
  } else {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${time}`;
  }
}

type FilterStatus = 'all' | 'success' | 'failed';

function LogRow({ log }: { log: EnrichedScheduleLog }) {
  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${log.success ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {log.success ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {log.deviceName}
            </span>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                log.action === 'on'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : log.action === 'off'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}
            >
              {log.action.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {log.scheduleName}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{log.triggerReason}</p>
          {!log.success && log.errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-900/30 p-2 rounded">
              {log.errorMessage}
            </p>
          )}
        </div>
        <div className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
          {formatLogTime(log.executedAt)}
        </div>
      </div>
    </div>
  );
}

export function Logs() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const { data: logs, isLoading, refetch, isRefetching } = useAllLogs(200);

  const filteredLogs = logs?.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'success') return log.success;
    if (filter === 'failed') return !log.success;
    return true;
  });

  const successCount = logs?.filter(l => l.success).length ?? 0;
  const failedCount = logs?.filter(l => !l.success).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Execution Logs</h1>
          <p className="text-gray-500 dark:text-gray-400">View all schedule execution history</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{logs?.length ?? 0}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Logs</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{successCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Successful</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === 'success'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Success
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === 'failed'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredLogs.map((log) => (
              <LogRow key={`${log.id}-${log.executedAt}`} log={log} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="font-medium">No logs found</p>
            <p className="text-sm">
              {filter !== 'all'
                ? 'Try changing the filter to see more logs'
                : 'Logs will appear here when schedules run'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
