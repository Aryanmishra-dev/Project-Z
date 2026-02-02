import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { authService } from '@/services/auth.service';
import type { User, LoginCredentials, RegisterData } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          // Also store tokens in localStorage for API interceptor
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('refreshToken', response.refreshToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.register(data);
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('refreshToken', response.refreshToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await authService.logout(refreshToken);
          }
        } catch {
          // Ignore logout errors
        } finally {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set(initialState);
        }
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set(initialState);
          return;
        }

        try {
          const response = await authService.refreshToken(refreshToken);
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('refreshToken', response.refreshToken);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set(initialState);
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth check timed out')), 5000);
          });

          const user = await Promise.race([authService.getProfile(), timeoutPromise]);

          set({
            user,
            accessToken: token,
            refreshToken: localStorage.getItem('refreshToken'),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ ...initialState, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
