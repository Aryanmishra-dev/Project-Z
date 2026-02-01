import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { API_BASE_URL } from '@/utils/constants';

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: Record<string, any>;

  constructor(message: string, code: string, status: number, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<{ error?: { code?: string; message?: string }; message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Network error
    if (!error.response) {
      throw new ApiError(
        'Network error. Please check your connection.',
        'NETWORK_ERROR',
        0
      );
    }

    const status = error.response.status;
    const errorData = error.response.data;

    // Handle 401 errors (unauthorized)
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refreshToken,
          });

          // Backend returns tokens nested inside data.tokens
          const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new ApiError(
          'Session expired. Please log in again.',
          'SESSION_EXPIRED',
          401
        );
      }
    }

    // Handle rate limiting
    if (status === 429) {
      throw new ApiError(
        'Too many requests. Please wait a moment.',
        'RATE_LIMITED',
        429
      );
    }

    // Handle server errors
    if (status >= 500) {
      throw new ApiError(
        'Server error. Please try again later.',
        'SERVER_ERROR',
        status
      );
    }

    // Handle validation errors
    if (status === 400 || status === 422) {
      throw new ApiError(
        errorData?.error?.message || errorData?.message || 'Validation error',
        errorData?.error?.code || 'VALIDATION_ERROR',
        status,
        errorData?.error
      );
    }

    // Handle forbidden
    if (status === 403) {
      throw new ApiError(
        'You do not have permission to perform this action.',
        'FORBIDDEN',
        403
      );
    }

    // Handle not found
    if (status === 404) {
      throw new ApiError(
        'Resource not found.',
        'NOT_FOUND',
        404
      );
    }

    // Generic error
    throw new ApiError(
      errorData?.error?.message || errorData?.message || 'An error occurred',
      errorData?.error?.code || 'UNKNOWN_ERROR',
      status
    );
  }
);

// Helper to extract error message
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.response?.data?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// Helper to check if error is a specific type
export function isApiError(error: unknown, code?: string): error is ApiError {
  if (error instanceof ApiError) {
    return code ? error.code === code : true;
  }
  return false;
}

