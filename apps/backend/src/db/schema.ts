import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// Prices table - stores half-hourly electricity prices
export const prices = sqliteTable('prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  validFrom: text('valid_from').notNull(),
  validTo: text('valid_to').notNull(),
  valueIncVat: real('value_inc_vat').notNull(),
  valueExcVat: real('value_exc_vat').notNull(),
  region: text('region').notNull().default('C'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
}, (table) => ({
  validFromIdx: index('idx_prices_valid_from').on(table.validFrom),
  regionIdx: index('idx_prices_region').on(table.region),
  uniquePrice: index('idx_prices_unique').on(table.validFrom, table.region),
}));

// Devices table - stores smart device configurations
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'switch', 'plug', 'heater', 'thermostat', 'hot_water'
  protocol: text('protocol').notNull(), // 'tuya-local', 'mock'
  config: text('config').notNull(), // JSON string
  status: text('status').default('offline'), // 'online', 'offline', 'unknown'
  lastSeen: text('last_seen'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Schedules table - stores automation rules
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  config: text('config').notNull(), // JSON string with schedule configuration
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Schedule execution logs
export const scheduleLogs = sqliteTable('schedule_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'on', 'off'
  triggerReason: text('trigger_reason'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('error_message'),
  executedAt: text('executed_at').default('CURRENT_TIMESTAMP'),
}, (table) => ({
  executedAtIdx: index('idx_schedule_logs_executed').on(table.executedAt),
}));

// App settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});
