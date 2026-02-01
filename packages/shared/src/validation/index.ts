/**
 * Validation schemas index
 * Exports all validation schemas and types
 */

// Common schemas
export {
  emailSchema,
  passwordSchema,
  uuidSchema,
  fullNameSchema,
  paginationSchema,
  sortDirectionSchema,
  dateRangeSchema,
  searchQuerySchema,
  idParamSchema,
  jwtTokenSchema,
  refreshTokenSchema as tokenSchema,
  type Email,
  type Password,
  type UUID,
  type FullName,
  type PaginationQuery,
  type DateRange,
  type SearchQuery,
  type IdParam,
} from './common.schemas';

// Auth schemas
export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  updateProfileSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  type RegisterInput,
  type LoginInput,
  type RefreshTokenInput,
  type LogoutInput,
  type ChangePasswordInput,
  type RequestPasswordResetInput,
  type ConfirmPasswordResetInput,
  type UpdateProfileInput,
  type VerifyEmailInput,
  type ResendVerificationInput,
} from './auth.schemas';
