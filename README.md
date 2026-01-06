# Energy Controller

Smart home energy controller with Octopus Agile tariff integration. Automatically schedules your smart devices to run during the cheapest electricity periods.

## Features

- **Real-time Agile prices** - View current and upcoming half-hourly electricity prices
- **Price visualization** - Color-coded charts showing cheap and expensive periods
- **Device control** - Local control of Tuya smart devices (Phase 2)
- **Smart scheduling** - Automate devices based on price thresholds (Phase 3)
- **Mobile-friendly** - Responsive design works on phone, tablet, and desktop

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- **Windows users**: Use WSL (recommended) or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) for native SQLite compilation

### Installation (WSL/Linux/Mac)

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter @octopus-controller/shared build

# Start development servers
pnpm dev
```

This starts:
- Backend API on http://localhost:3001
- Frontend on http://localhost:5173

### Configuration

1. Open http://localhost:5173
2. Go to **Settings**
3. Select your electricity region (A-P)
4. Click **Refresh** on the Dashboard to fetch prices

## Project Structure

```
octopus_api_controller/
├── apps/
│   ├── backend/          # Express + TypeScript API
│   └── frontend/         # React + Vite frontend
├── packages/
│   └── shared/           # Shared types & utilities
└── scripts/              # Setup helpers
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Device Control | TuyAPI (Phase 2) |

## API Endpoints

```
GET  /api/prices/current    - Current electricity price
GET  /api/prices/today      - Today's prices
GET  /api/prices/cheapest   - Cheapest N hours
POST /api/prices/refresh    - Fetch latest prices

GET  /api/settings          - App settings
PUT  /api/settings          - Update settings
GET  /api/settings/regions  - Available regions
```

## Electricity Regions

| Code | Area |
|------|------|
| A | Eastern England |
| B | East Midlands |
| C | London |
| D | Merseyside & N. Wales |
| E | West Midlands |
| F | North Eastern England |
| G | North Western England |
| H | Southern England |
| J | South Eastern England |
| K | Southern Wales |
| L | South Western England |
| M | Yorkshire |
| N | Southern Scotland |
| P | Northern Scotland |

## Development

```bash
# Run backend only
pnpm dev:backend

# Run frontend only
pnpm dev:frontend

# Build all packages
pnpm build
```

## Roadmap

- [x] Phase 1: Price fetching & display
- [ ] Phase 2: Device control (Tuya local)
- [ ] Phase 3: Automated scheduling
- [ ] Phase 4: PWA & notifications

## License

MIT
