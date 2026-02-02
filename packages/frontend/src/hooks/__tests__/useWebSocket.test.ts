import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock setup using vi.hoisted to ensure availability in the factory
const { mockSocket, socketHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, (data?: any) => void>();

  const socket = {
    on: vi.fn((event: string, callback: any) => {
      handlers.set(event, callback);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    emit: vi.fn(),
    connect: vi.fn(() => {
      socket.connected = true;
      handlers.get('connect')?.();
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      handlers.get('disconnect')?.();
    }),
    connected: false,
    id: 'mock-socket-id',
  };

  return { mockSocket: socket, socketHandlers: handlers };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
  default: vi.fn(() => mockSocket),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    accessToken: 'mock-valid-token',
  })),
}));

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    mockSocket.connected = false;
  });

  describe('Connection Management', () => {
    it('should establish connection on mount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(mockSocket.connect).toHaveBeenCalled();
      });
    });

    it('should disconnect on unmount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should track connection status', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      // Simulate connection
      act(() => {
        // Manually trigger connect if not called automatically or to ensure state sync
        // The mock.connect() above triggers the handler, but renderHook might run before connect
        // So we trigger the handler explicitly to simulate the server saying "connected"
        const handler = socketHandlers.get('connect');
        if (handler) handler();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to custom events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());
      const mockHandler = vi.fn();

      act(() => {
        result.current.on('test-event', mockHandler);
      });

      expect(mockSocket.on).toHaveBeenCalledWith('test-event', expect.any(Function));
    });

    it('should emit events to server', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      mockSocket.connected = true;

      act(() => {
        result.current.emit('test-event', { data: 123 });
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 123 });
    });
  });
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
  default: vi.fn(() => mockSocket),
}));

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    accessToken: 'mock-valid-token',
  })),
}));

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    // Auto-fake connection event when 'connect' handler attached?
    // Or we manually trigger it in tests.
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish connection on mount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(mockSocket.connect).toHaveBeenCalled();
      });
    });

    it('should disconnect on unmount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
    });

    it('should track connection status', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      // Simulate successful connection
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      act(() => {
        if (connectHandler) connectHandler();
      });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to custom events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());
      const mockHandler = vi.fn();

      act(() => {
        result.current.on('test-event', mockHandler);
      });

      expect(mockSocket.on).toHaveBeenCalledWith('test-event', mockHandler);
    });

    it('should unsubscribe from events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());
      const mockHandler = vi.fn();

      let unsubscribe: () => void;
      act(() => {
        unsubscribe = result.current.on('test-event', mockHandler);
      });

      act(() => {
        if (unsubscribe) unsubscribe();
      });

      expect(mockSocket.off).toHaveBeenCalledWith('test-event', mockHandler);
    });

    it('should emit events to server', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      // Simulate connection so emit works
      mockSocket.connected = true;

      act(() => {
        result.current.emit('test-event', { data: 123 });
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 123 });
    });
  });

  describe('Authentication Integration', () => {
    it('should send auth token on connection', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      renderHook(() => useWebSocket());

      const { io } = await import('socket.io-client');
      await waitFor(() => {
        expect(io).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            auth: { token: 'mock-valid-token' },
          })
        );
      });
    });
  });

  describe('Room Management', () => {
    it('should join a room', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      mockSocket.connected = true;

      act(() => {
        result.current.joinRoom('test-room');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join:room', { room: 'test-room' });
    });
  });
});
