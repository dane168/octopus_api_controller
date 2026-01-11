import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import { authRoutes } from './routes/auth.js';
import { priceRoutes } from './routes/prices.js';
import { deviceRoutes } from './routes/devices.js';
import { scheduleRoutes } from './routes/schedules.js';
import { settingsRoutes } from './routes/settings.js';
import tuyaRoutes from './routes/tuya.js';
import { config } from './config/index.js';

export const app = express();

// Middleware
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tuya', tuyaRoutes);

// Error handling
app.use(errorHandler);
