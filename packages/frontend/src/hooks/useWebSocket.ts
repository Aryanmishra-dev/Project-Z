import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { useAuthStore } from '@/stores/authStore';
import { API_BASE_URL } from '@/utils/constants';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
}

type EventCallback<T = unknown> = (data: T) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  on: <T = unknown>(event: string, callback: EventCallback<T>) => () => void;
  emit: <T = unknown>(event: string, data?: T) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  socket: Socket | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const { accessToken } = useAuthStore();

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    const socket = io(API_BASE_URL, {
      autoConnect: false,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setState({ isConnected: true, isConnecting: false, error: null });
      console.log('[WebSocket] Connected');
    });

    socket.on('disconnect', (reason) => {
      setState({ isConnected: false, isConnecting: false, error: null });
      console.log('[WebSocket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      setState({ isConnected: false, isConnecting: false, error });
      console.error('[WebSocket] Connection error:', error);
    });

    // Re-attach existing listeners
    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        socket.on(event, callback);
      });
    });

    socketRef.current = socket;
    socket.connect();
  }, [accessToken, reconnection, reconnectionAttempts, reconnectionDelay]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Subscribe to an event
  const on = useCallback(<T = unknown>(event: string, callback: EventCallback<T>) => {
    // Add to listeners ref
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback as EventCallback);

    // If socket exists, add listener
    if (socketRef.current) {
      socketRef.current.on(event, callback as EventCallback);
    }

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(event)?.delete(callback as EventCallback);
      if (socketRef.current) {
        socketRef.current.off(event, callback as EventCallback);
      }
    };
  }, []);

  // Emit an event
  const emit = useCallback(<T = unknown>(event: string, data?: T) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('[WebSocket] Cannot emit, socket not connected');
    }
  }, []);

  // Join a room
  const joinRoom = useCallback(
    (room: string) => {
      emit('join:room', { room });
    },
    [emit]
  );

  // Leave a room
  const leaveRoom = useCallback(
    (room: string) => {
      emit('leave:room', { room });
    },
    [emit]
  );

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && accessToken) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, accessToken, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    on,
    emit,
    joinRoom,
    leaveRoom,
    socket: socketRef.current,
  };
}

// Specialized hook for PDF processing updates
export interface PDFProcessingUpdate {
  pdfId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  error?: string;
}

export function usePDFProcessingSocket(pdfId: string | null) {
  const { on, joinRoom, leaveRoom, isConnected } = useWebSocket();
  const [update, setUpdate] = useState<PDFProcessingUpdate | null>(null);

  useEffect(() => {
    if (!pdfId || !isConnected) return;

    const room = `pdf:${pdfId}`;
    joinRoom(room);

    const unsubscribe = on<PDFProcessingUpdate>('pdf:processing:update', (data) => {
      if (data.pdfId === pdfId) {
        setUpdate(data);
      }
    });

    return () => {
      leaveRoom(room);
      unsubscribe();
    };
  }, [pdfId, isConnected, joinRoom, leaveRoom, on]);

  return { update, isConnected };
}

// Hook for quiz real-time updates (if needed)
export interface QuizUpdate {
  sessionId: string;
  type: 'time_warning' | 'session_expired' | 'submission_received';
  data?: Record<string, unknown>;
}

export function useQuizSocket(sessionId: string | null) {
  const { on, joinRoom, leaveRoom, isConnected, emit } = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<QuizUpdate | null>(null);

  useEffect(() => {
    if (!sessionId || !isConnected) return;

    const room = `quiz:${sessionId}`;
    joinRoom(room);

    const unsubscribe = on<QuizUpdate>('quiz:update', (data) => {
      if (data.sessionId === sessionId) {
        setLastUpdate(data);
      }
    });

    return () => {
      leaveRoom(room);
      unsubscribe();
    };
  }, [sessionId, isConnected, joinRoom, leaveRoom, on]);

  const submitAnswer = useCallback(
    (questionId: string, answerId: string) => {
      emit('quiz:answer', { sessionId, questionId, answerId });
    },
    [sessionId, emit]
  );

  return { lastUpdate, isConnected, submitAnswer };
}
