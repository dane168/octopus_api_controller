import 'dotenv/config';
import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initDatabase } from './db/index.js';
import { startJobs } from './jobs/index.js';

async function main() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Start cron jobs
    startJobs();
    logger.info('Cron jobs started');

    // Start server
    app.listen(config.PORT, () => {
      logger.info(`Server running on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
