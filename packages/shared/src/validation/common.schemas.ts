/**
 * Common validation schemas and patterns
 * Reusable validation components
 */
import { z } from 'zod';

/**
 * Email validation with normalization
 */
export const emailSchema = z
  .string()
  .trim() // Trim first before validation
  .toLowerCase()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters');

/**
 * Password validation with strength requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    'Password must contain at least one special character'
  );

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Full name validation
 */
export const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .transform((name) => name.trim());

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
});

/**
 * Sort direction enum
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

/**
 * Date range schema
 */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be before or equal to end date' }
  );

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query cannot be empty').max(200, 'Search query too long').optional(),
});

/**
 * ID params schema (for route params)
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * JWT token schema (basic string validation)
 */
export const jwtTokenSchema = z
  .string()
  .min(10, 'Invalid token')
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Invalid JWT format');

/**
 * Refresh token schema (looser validation for different token formats)
 */
export const refreshTokenSchema = z.string().min(10, 'Invalid refresh token');

// Type exports for use in application code
export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type FullName = z.infer<typeof fullNameSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
