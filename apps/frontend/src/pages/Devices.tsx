import { Plug, Plus } from 'lucide-react';

export function Devices() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-500">Manage your smart home devices</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" disabled>
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      <div className="card p-8 text-center">
        <Plug className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Device Control Coming Soon</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Phase 2 will add support for controlling your Tuya smart devices locally.
          You'll be able to add plugs, switches, heaters, and more.
        </p>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
          <h3 className="font-medium text-gray-900 mb-2">What you'll need:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Tuya IoT Platform developer account</li>
            <li>• Device IDs and local keys from the platform</li>
            <li>• Devices on the same local network</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
