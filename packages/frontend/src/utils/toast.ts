/**
 * Toast notification utility
 * Provides a simple interface for showing toast notifications
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  description?: string;
  duration: number;
}

// Toast event emitter for integration with UI
type ToastListener = (toast: Toast) => void;
const listeners: Set<ToastListener> = new Set();

export function addToastListener(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function createToast(type: ToastType, message: string | ToastOptions): Toast {
  const options = typeof message === 'string' ? { title: message } : message;
  const toast: Toast = {
    id: Math.random().toString(36).substring(2, 9),
    type,
    title: options.title,
    description: options.description,
    duration: options.duration ?? 5000,
  };

  // Notify all listeners
  listeners.forEach((listener) => listener(toast));

  return toast;
}

export const toast = {
  success: (message: string | ToastOptions) => createToast('success', message),
  error: (message: string | ToastOptions) => createToast('error', message),
  warning: (message: string | ToastOptions) => createToast('warning', message),
  info: (message: string | ToastOptions) => createToast('info', message),
};

export default toast;
