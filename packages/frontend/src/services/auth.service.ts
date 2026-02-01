import { api } from '@/lib/api';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User
} from '@/types';
import { settingsService } from './settings.service';

// Backend response structure (tokens are nested)
interface BackendAuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: BackendAuthResponse }>(
      '/api/v1/auth/login',
      credentials
    );
    const { user, tokens } = response.data.data;
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: BackendAuthResponse }>(
      '/api/v1/auth/register',
      data
    );
    const { user, tokens } = response.data.data;
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  },

  /**
   * Logout the current user
   */
  async logout(refreshToken: string): Promise<void> {
    await api.post('/api/v1/auth/logout', { refreshToken });
  },

  /**
   * Refresh the access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await api.post<{
      success: boolean;
      data: { tokens: { accessToken: string; refreshToken: string; expiresIn: number } }
    }>('/api/v1/auth/refresh', { refreshToken });
    const { tokens } = response.data.data;
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  },

  /**
   * Get the current user's profile
   */
  async getProfile(): Promise<User> {
    const response = await api.get<{ success: boolean; data: { user: User } }>(
      '/api/v1/auth/me'
    );
    return response.data.data.user;
  },

  /**
   * Update the current user's profile
   * @deprecated Use settingsService.updateProfile() instead
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    return settingsService.updateProfile(data);
  },

  /**
   * Change password
   * @deprecated Use settingsService.changePassword() instead
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return settingsService.changePassword(currentPassword, newPassword);
  },
};
