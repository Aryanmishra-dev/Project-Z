/**
 * Users table schema
 * Core user authentication and profile data
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * User roles enum for access control
 */
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

/**
 * Users table definition
 * Stores user credentials, profile information, and soft delete support
 */
export const users = pgTable(
  'users',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** User email address (unique, case-insensitive enforced at app level) */
    email: varchar('email', { length: 255 }).notNull(),

    /** Argon2id password hash */
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    /** User's full name */
    fullName: varchar('full_name', { length: 100 }).notNull(),

    /** User role for authorization */
    role: userRoleEnum('role').default('user').notNull(),

    /** Whether email has been verified */
    emailVerified: boolean('email_verified').default(false).notNull(),

    /** Record creation timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Record last update timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    /** Soft delete timestamp (null if not deleted) */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    /** Unique index on email for non-deleted users only (partial index) */
    emailUniqueIdx: uniqueIndex('idx_users_email')
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),

    /** Index for role-based queries */
    roleIdx: index('idx_users_role').on(table.role),

    /** Index for created_at ordering */
    createdAtIdx: index('idx_users_created_at').on(table.createdAt),
  })
);

/**
 * Type inference for user records
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
