/**
 * PDFs table schema
 * Stores uploaded PDF documents and their processing status
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * PDF processing status enum
 */
export const pdfStatusEnum = pgEnum('pdf_status', [
  'pending', // Uploaded, awaiting processing
  'processing', // Currently being processed by NLP service
  'completed', // Successfully processed
  'failed', // Processing failed
  'cancelled', // User cancelled processing
]);

/**
 * PDF metadata JSON structure
 */
export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  extractedTextLength?: number;
  language?: string;
}

/**
 * PDFs table definition
 * Tracks uploaded documents and their processing lifecycle
 */
export const pdfs = pgTable(
  'pdfs',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Reference to owning user */
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    /** Original filename as uploaded */
    filename: varchar('filename', { length: 255 }).notNull(),

    /** Server-side file path */
    filePath: text('file_path').notNull(),

    /** File size in bytes */
    fileSizeBytes: integer('file_size_bytes').notNull(),

    /** Number of pages in the PDF */
    pageCount: integer('page_count'),

    /** Current processing status */
    status: pdfStatusEnum('status').default('pending').notNull(),

    /** Timestamp when processing started */
    processingStartedAt: timestamp('processing_started_at', { withTimezone: true }),

    /** Timestamp when processing completed */
    processingCompletedAt: timestamp('processing_completed_at', { withTimezone: true }),

    /** Additional PDF metadata (JSONB) */
    metadata: jsonb('metadata').$type<PdfMetadata>(),

    /** Processing error message if failed */
    errorMessage: text('error_message'),

    /** Record creation timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Record last update timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    /** Soft delete timestamp */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    /** Index for user's PDFs lookup */
    userIdIdx: index('idx_pdfs_user_id').on(table.userId),

    /** Index for status filtering */
    statusIdx: index('idx_pdfs_status').on(table.status),

    /** Index for ordering by creation date */
    createdAtIdx: index('idx_pdfs_created_at').on(table.createdAt),

    /** Composite index for user's PDFs by status */
    userStatusIdx: index('idx_pdfs_user_status').on(table.userId, table.status),
  })
);

/**
 * Type inference for PDF records
 */
export type Pdf = typeof pdfs.$inferSelect;
export type NewPdf = typeof pdfs.$inferInsert;
