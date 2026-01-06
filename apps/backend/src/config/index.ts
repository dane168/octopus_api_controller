import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().default('./data/octopus-controller.db'),
  OCTOPUS_REGION: z.string().optional(),
  OCTOPUS_API_KEY: z.string().optional(),
  OCTOPUS_MPAN: z.string().optional(),
  OCTOPUS_SERIAL: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
