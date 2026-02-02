/**
 * User Settings Service
 * Profile management, security, and preferences
 */
import { hash, verify } from 'argon2';
import { eq, and, ne, sql, desc, isNull, count } from 'drizzle-orm';

import { redis } from '../config/redis';
import { db } from '../db';
import { pdfs } from '../db/schema/pdfs';
import { questions } from '../db/schema/questions';
import { quizSessions } from '../db/schema/quiz-sessions';
import { refreshTokens } from '../db/schema/refresh-tokens';
import { userAnswers } from '../db/schema/user-answers';
import { users } from '../db/schema/users';
import { logger } from '../utils/logger';

/**
 * User profile update data
 */
export interface ProfileUpdateData {
  fullName?: string;
  email?: string;
}

/**
 * Password change data
 */
export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

/**
 * User session info
 */
export interface UserSession {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastUsed: Date;
  createdAt: Date;
  isCurrent: boolean;
}

/**
 * Account export data
 */
export interface AccountExportData {
  profile: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    createdAt: Date;
    emailVerified: boolean;
  };
  pdfs: Array<{
    id: string;
    filename: string;
    status: string;
    createdAt: Date;
    questionCount: number;
  }>;
  quizzes: Array<{
    id: string;
    pdfFilename: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  statistics: {
    totalPdfs: number;
    totalQuizzes: number;
    totalQuestionsAnswered: number;
    overallAccuracy: number;
    memberSince: Date;
  };
  exportedAt: Date;
}

class UserSettingsService {
  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    return user[0];
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: ProfileUpdateData) {
    // If email is being changed, check uniqueness
    if (data.email) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, data.email.toLowerCase()),
            ne(users.id, userId),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error('Email already in use');
      }
    }

    const updateData: Partial<{ fullName: string; email: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };

    if (data.fullName) {
      updateData.fullName = data.fullName.trim();
    }

    if (data.email) {
      updateData.email = data.email.toLowerCase().trim();
    }

    const result = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        emailVerified: users.emailVerified,
        updatedAt: users.updatedAt,
      });

    if (result.length === 0) {
      throw new Error('User not found');
    }

    logger.info('Profile updated', { userId });
    return result[0];
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, data: PasswordChangeData) {
    // Get current password hash
    const user = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verify(user[0].passwordHash, data.currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newHash = await hash(data.newPassword, {
      type: 2, // Argon2id
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate all refresh tokens for security
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    logger.info('Password changed', { userId });
    return { success: true };
  }

  /**
   * Get active sessions
   */
  async getSessions(userId: string, currentTokenId?: string): Promise<UserSession[]> {
    const sessions = await db
      .select({
        id: refreshTokens.id,
        deviceInfo: refreshTokens.deviceInfo,
        ipAddress: refreshTokens.ipAddress,
        lastUsed: refreshTokens.lastUsedAt,
        createdAt: refreshTokens.createdAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          sql`${refreshTokens.expiresAt} > NOW()`,
          isNull(refreshTokens.revokedAt)
        )
      )
      .orderBy(desc(refreshTokens.lastUsedAt));

    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      lastUsed: session.lastUsed || session.createdAt,
      createdAt: session.createdAt,
      isCurrent: session.id === currentTokenId,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string) {
    const result = await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId)));

    logger.info('Session revoked', { userId, sessionId });
    return { success: true };
  }

  /**
   * Revoke all other sessions
   */
  async revokeAllOtherSessions(userId: string, currentTokenId?: string) {
    if (currentTokenId) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), ne(refreshTokens.id, currentTokenId)));
    } else {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    }

    logger.info('All other sessions revoked', { userId });
    return { success: true };
  }

  /**
   * Export all user data
   */
  async exportData(userId: string): Promise<AccountExportData> {
    // Get profile
    const profile = await this.getProfile(userId);

    // Get PDFs with question counts
    const userPdfs = await db
      .select({
        id: pdfs.id,
        filename: pdfs.filename,
        status: pdfs.status,
        createdAt: pdfs.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE pdf_id = ${pdfs.id})::int`,
      })
      .from(pdfs)
      .where(eq(pdfs.userId, userId))
      .orderBy(desc(pdfs.createdAt));

    // Get quizzes
    const userQuizzes = await db
      .select({
        id: quizSessions.id,
        pdfId: quizSessions.pdfId,
        pdfFilename: pdfs.filename,
        score: quizSessions.scorePercentage,
        totalQuestions: quizSessions.totalQuestions,
        correctAnswers: quizSessions.correctAnswers,
        status: quizSessions.status,
        startedAt: quizSessions.startedAt,
        completedAt: quizSessions.completedAt,
      })
      .from(quizSessions)
      .leftJoin(pdfs, eq(quizSessions.pdfId, pdfs.id))
      .where(eq(quizSessions.userId, userId))
      .orderBy(desc(quizSessions.startedAt));

    // Get statistics
    const stats = await db
      .select({
        totalQuestionsAnswered: count(),
        correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::int`,
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .where(eq(quizSessions.userId, userId));

    const totalQuestionsAnswered = Number(stats[0]?.totalQuestionsAnswered) || 0;
    const correctAnswers = stats[0]?.correctAnswers || 0;
    const overallAccuracy =
      totalQuestionsAnswered > 0
        ? Math.round((correctAnswers / totalQuestionsAnswered) * 100 * 100) / 100
        : 0;

    logger.info('Data export generated', { userId });

    return {
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        createdAt: profile.createdAt,
        emailVerified: profile.emailVerified,
      },
      pdfs: userPdfs.map((pdf) => ({
        id: pdf.id,
        filename: pdf.filename,
        status: pdf.status,
        createdAt: pdf.createdAt,
        questionCount: pdf.questionCount,
      })),
      quizzes: userQuizzes.map((quiz) => ({
        id: quiz.id,
        pdfFilename: quiz.pdfFilename || 'Unknown',
        score: Number(quiz.score) || 0,
        totalQuestions: quiz.totalQuestions,
        correctAnswers: quiz.correctAnswers,
        status: quiz.status as string,
        startedAt: quiz.startedAt,
        completedAt: quiz.completedAt!,
      })),
      statistics: {
        totalPdfs: userPdfs.length,
        totalQuizzes: userQuizzes.length,
        totalQuestionsAnswered,
        overallAccuracy,
        memberSince: profile.createdAt,
      },
      exportedAt: new Date(),
    };
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId: string, password: string) {
    // Verify password
    const user = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const isValid = await verify(user[0].passwordHash, password);
    if (!isValid) {
      throw new Error('Password is incorrect');
    }

    // Soft delete user
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Revoke all refresh tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // Clear caches
    try {
      const cacheKeys = await redis.keys(`*:${userId}*`);
      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }
    } catch (error) {
      logger.warn('Cache clear failed during account deletion', { error });
    }

    logger.info('Account deleted', { userId });
    return { success: true };
  }
}

export const userSettingsService = new UserSettingsService();
