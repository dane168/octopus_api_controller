import { Router } from 'express';

export const deviceRoutes = Router();

// Placeholder - will be implemented in Phase 2
deviceRoutes.get('/', (_req, res) => {
  res.json({ devices: [], message: 'Device management coming in Phase 2' });
});

deviceRoutes.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'Device management not yet implemented' });
});

deviceRoutes.post('/', (_req, res) => {
  res.status(501).json({ error: 'Device management not yet implemented' });
});

deviceRoutes.put('/:id', (_req, res) => {
  res.status(501).json({ error: 'Device management not yet implemented' });
});

deviceRoutes.delete('/:id', (_req, res) => {
  res.status(501).json({ error: 'Device management not yet implemented' });
});

deviceRoutes.post('/:id/control', (_req, res) => {
  res.status(501).json({ error: 'Device control not yet implemented' });
});
