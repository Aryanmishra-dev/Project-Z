import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

import { ProtectedRoute } from '@/components/common';
import { AuthLayout } from '@/components/features/auth';
import { RootLayout, AppLayout } from '@/layouts';
import {
  HomePage,
  LoginPage,
  RegisterPage,
  DashboardPage,
  PDFsPage,
  PDFDetailPage,
  QuizPage,
  QuizResultsPage,
  AnalyticsPage,
  SettingsPage,
  NotFoundPage,
} from '@/pages';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      // Public routes
      {
        index: true,
        element: <HomePage />,
      },

      // Auth routes
      {
        element: <AuthLayout />,
        children: [
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'register',
            element: <RegisterPage />,
          },
        ],
      },

      // Protected routes with app layout
      {
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'pdfs',
            element: <PDFsPage />,
          },
          {
            path: 'pdfs/:id',
            element: <PDFDetailPage />,
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },

      // Quiz routes (protected, no app layout for full-screen experience)
      {
        path: 'quiz/:sessionId',
        element: (
          <ProtectedRoute>
            <QuizPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'quiz/:sessionId/results',
        element: (
          <ProtectedRoute>
            <QuizResultsPage />
          </ProtectedRoute>
        ),
      },

      // 404
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router: RouterProviderProps['router'] = createBrowserRouter(routes);
