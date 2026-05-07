import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// --- BetterAuth tables (geradas automaticamente, mas declaradas aqui para relações) ---

export const user = pgTable('user', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image:         text('image'),
  createdAt:     timestamp('created_at').notNull(),
  updatedAt:     timestamp('updated_at').notNull(),
});

export const session = pgTable('session', {
  id:             text('id').primaryKey(),
  expiresAt:      timestamp('expires_at').notNull(),
  token:          text('token').notNull().unique(),
  createdAt:      timestamp('created_at').notNull(),
  updatedAt:      timestamp('updated_at').notNull(),
  ipAddress:      text('ip_address'),
  userAgent:      text('user_agent'),
  userId:         text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id:                   text('id').primaryKey(),
  accountId:            text('account_id').notNull(),
  providerId:           text('provider_id').notNull(),
  userId:               text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken:          text('access_token'),
  refreshToken:         text('refresh_token'),
  idToken:              text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt:timestamp('refresh_token_expires_at'),
  scope:                text('scope'),
  password:             text('password'),
  createdAt:            timestamp('created_at').notNull(),
  updatedAt:            timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  timestamp('expires_at').notNull(),
  createdAt:  timestamp('created_at'),
  updatedAt:  timestamp('updated_at'),
});

// --- Tabelas do domínio ---

export const bot = pgTable('bot', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  prompt:    text('prompt').notNull(),
  code:      text('code').notNull(),
  active:    boolean('active').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const killEvent = pgTable('kill_event', {
  id:           text('id').primaryKey(),
  killerBotId:  text('killer_bot_id').notNull(),
  victimBotId:  text('victim_bot_id').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
});

export const promptCache = pgTable('prompt_cache', {
  id:           text('id').primaryKey(),
  promptHash:   text('prompt_hash').notNull().unique(),
  code:         text('code').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
});
