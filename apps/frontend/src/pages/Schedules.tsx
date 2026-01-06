import { Calendar, Plus } from 'lucide-react';

export function Schedules() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500">Automate devices based on prices</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" disabled>
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      <div className="card p-8 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Scheduling Coming Soon</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Phase 3 will add automated scheduling. You'll be able to configure devices
          to turn on during the cheapest hours automatically.
        </p>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
          <h3 className="font-medium text-gray-900 mb-2">Planned schedule types:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              <span className="font-medium">Price Threshold</span>
              <p className="text-gray-500">Turn on when price drops below X p/kWh</p>
            </li>
            <li>
              <span className="font-medium">Cheapest Hours</span>
              <p className="text-gray-500">Run during cheapest N hours in a time window</p>
            </li>
            <li>
              <span className="font-medium">Time Range</span>
              <p className="text-gray-500">Run during specific time slots</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
