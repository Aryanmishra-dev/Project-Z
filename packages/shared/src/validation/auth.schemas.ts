/**
 * Authentication validation schemas
 * Schemas for auth-related requests
 */
import { z } from 'zod';
import { 
  emailSchema, 
  passwordSchema, 
  fullNameSchema,
  refreshTokenSchema as baseRefreshTokenSchema,
} from './common.schemas';

/**
 * User registration request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

/**
 * User login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Token refresh request schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: baseRefreshTokenSchema,
});

/**
 * Logout request schema
 */
export const logoutSchema = z.object({
  refreshToken: baseRefreshTokenSchema,
});

/**
 * Change password request schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { 
    message: 'New password must be different from current password',
    path: ['newPassword'],
  }
);

/**
 * Password reset request schema (initiate reset)
 */
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset confirmation schema (complete reset)
 */
export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: emailSchema.optional(),
}).refine(
  (data) => data.fullName !== undefined || data.email !== undefined,
  { message: 'At least one field must be provided' }
);

/**
 * Email verification schema
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Resend verification email schema
 */
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
