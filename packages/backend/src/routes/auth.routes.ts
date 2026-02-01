/**
 * Authentication routes
 * Defines all auth-related API endpoints
 */
import { Router } from 'express';
import { authController } from '../controllers';
import { 
  authenticate, 
  validate, 
  authRateLimiter,
  loginRateLimiter,
} from '../middleware';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  logoutSchema,
} from '@project-z/shared';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Creates a new user account and returns authentication tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 *       429:
 *         description: Too many requests
 */
router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  authController.register
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     description: Authenticates user and returns access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Exchange refresh token for new access and refresh tokens (rotation)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh',
  authRateLimiter,
  validate(refreshTokenSchema),
  authController.refresh
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout current session
 *     description: Invalidates the provided refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post(
  '/logout',
  validate(logoutSchema),
  authController.logout
);

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout all sessions
 *     description: Invalidates all refresh tokens for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions logged out
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user profile
 *     description: Returns the profile of the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/me',
  authenticate,
  authController.getProfile
);

export const authRoutes = router;
