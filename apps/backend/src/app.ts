import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import { priceRoutes } from './routes/prices.js';
import { deviceRoutes } from './routes/devices.js';
import { scheduleRoutes } from './routes/schedules.js';
import { settingsRoutes } from './routes/settings.js';

export const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/prices', priceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling
app.use(errorHandler);
