import { api } from '@/lib/api';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastUsed: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface AccountExportData {
  profile: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    createdAt: string;
    emailVerified: boolean;
  };
  pdfs: Array<{
    id: string;
    filename: string;
    status: string;
    createdAt: string;
    questionCount: number;
  }>;
  quizzes: Array<{
    id: string;
    pdfFilename: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    status: string;
    startedAt: string;
    completedAt: string | null;
  }>;
  statistics: {
    totalPdfs: number;
    totalQuizzes: number;
    totalQuestionsAnswered: number;
    overallAccuracy: number;
    memberSince: string;
  };
  exportedAt: string;
}

export const settingsService = {
  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile> {
    const response = await api.get<{
      success: boolean;
      data: UserProfile;
    }>('/api/v1/settings/profile');
    return response.data.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: { fullName?: string; email?: string }): Promise<UserProfile> {
    const response = await api.patch<{
      success: boolean;
      data: UserProfile;
      message: string;
    }>('/api/v1/settings/profile', data);
    return response.data.data;
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/api/v1/settings/password', {
      currentPassword,
      newPassword,
    });
  },

  /**
   * Get active sessions
   */
  async getSessions(): Promise<UserSession[]> {
    const response = await api.get<{
      success: boolean;
      data: UserSession[];
    }>('/api/v1/settings/sessions');
    return response.data.data;
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/api/v1/settings/sessions/${sessionId}`);
  },

  /**
   * Revoke all other sessions
   */
  async revokeAllOtherSessions(): Promise<void> {
    await api.delete('/api/v1/settings/sessions');
  },

  /**
   * Export account data
   */
  async exportData(): Promise<AccountExportData> {
    const response = await api.get<AccountExportData>('/api/v1/settings/export');
    return response.data;
  },

  /**
   * Delete account
   */
  async deleteAccount(password: string): Promise<void> {
    await api.delete('/api/v1/settings/account', {
      data: {
        password,
        confirmation: 'DELETE MY ACCOUNT',
      },
    });
  },
};
