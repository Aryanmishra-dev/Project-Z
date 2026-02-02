/**
 * User Settings Routes
 * Profile, security, preferences, and account management
 */
import { Router } from 'express';
import { z } from 'zod';

import { authenticate, asyncHandler, validate } from '../middleware';
import { AuthenticatedRequest } from '../middleware/auth';
import { userSettingsService } from '../services/user-settings.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Profile update validation schema
 */
const updateProfileSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
    })
    .refine((data) => data.fullName || data.email, {
      message: 'At least one field is required',
    }),
});

/**
 * Password change validation schema
 */
const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[0-9]/, 'Password must contain number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  }),
});

/**
 * Revoke session validation schema
 */
const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
  }),
});

/**
 * Delete account validation schema
 */
const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
    confirmation: z.literal('DELETE MY ACCOUNT'),
  }),
});

/**
 * @swagger
 * /api/v1/settings/profile:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get user profile
 *     description: Get current user's profile information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get(
  '/profile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const profile = await userSettingsService.getProfile(userId);

    res.json({
      success: true,
      data: profile,
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/profile:
 *   patch:
 *     tags:
 *       - Settings
 *     summary: Update user profile
 *     description: Update current user's profile information
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Updated profile
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
router.patch(
  '/profile',
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const userId = req.user!.sub;

    try {
      const profile = await userSettingsService.updateProfile(userId, req.body);

      res.json({
        success: true,
        data: profile,
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      if (error.message === 'Email already in use') {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_IN_USE',
            message: 'This email address is already in use',
          },
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/settings/password:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Change password
 *     description: Change current user's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Current password incorrect
 */
router.put(
  '/password',
  validate(changePasswordSchema),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const userId = req.user!.sub;

    try {
      await userSettingsService.changePassword(userId, req.body);

      res.json({
        success: true,
        message: 'Password changed successfully. Please log in again.',
      });
    } catch (error: any) {
      if (error.message === 'Current password is incorrect') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect',
          },
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/settings/sessions:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get active sessions
 *     description: Get list of all active sessions for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get(
  '/sessions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const currentTokenId = req.user!.tokenId;

    const sessions = await userSettingsService.getSessions(userId, currentTokenId);

    res.json({
      success: true,
      data: sessions,
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/sessions/{sessionId}:
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Revoke a session
 *     description: Revoke a specific session by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.delete(
  '/sessions/:sessionId',
  validate(revokeSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { sessionId } = req.params;

    await userSettingsService.revokeSession(userId, sessionId);

    res.json({
      success: true,
      message: 'Session revoked',
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/sessions:
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Revoke all other sessions
 *     description: Revoke all sessions except the current one
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked
 */
router.delete(
  '/sessions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const currentTokenId = req.user!.tokenId;

    await userSettingsService.revokeAllOtherSessions(userId, currentTokenId);

    res.json({
      success: true,
      message: 'All other sessions revoked',
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/export:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Export account data
 *     description: Export all user data (GDPR compliant)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account data export
 */
router.get(
  '/export',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;

    const data = await userSettingsService.exportData(userId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="account-data-${new Date().toISOString().split('T')[0]}.json"`
    );

    res.json(data);
  })
);

/**
 * @swagger
 * /api/v1/settings/account:
 *   delete:
 *     tags:
 *       - Settings
 *     summary: Delete account
 *     description: Permanently delete user account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmation
 *             properties:
 *               password: { type: string }
 *               confirmation: { type: string, enum: ['DELETE MY ACCOUNT'] }
 *     responses:
 *       200:
 *         description: Account deleted
 *       400:
 *         description: Invalid password or confirmation
 */
router.delete(
  '/account',
  validate(deleteAccountSchema),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const userId = req.user!.sub;

    try {
      await userSettingsService.deleteAccount(userId, req.body.password);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error: any) {
      if (error.message === 'Password is incorrect') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Password is incorrect',
          },
        });
        return;
      }
      throw error;
    }
  })
);

export { router as settingsRoutes };
