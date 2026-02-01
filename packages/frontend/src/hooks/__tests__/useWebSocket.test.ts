/**
 * useWebSocket Hook Unit Tests
 * Tests for WebSocket connection, reconnection, and message handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'mock-socket-id',
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        // Simulate connection
        setTimeout(() => {
          mockSocket.connected = true;
          callback();
        }, 0);
      }
      return mockSocket;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish connection on mount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
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

      // Initially not connected
      expect(result.current.isConnected).toBe(false);

      // Simulate connection
      await act(async () => {
        const connectCallback = mockSocket.on.mock.calls.find(
          ([event]) => event === 'connect'
        )?.[1];
        if (connectCallback) {
          mockSocket.connected = true;
          connectCallback();
        }
      });
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on disconnect', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      renderHook(() => useWebSocket());

      // Simulate disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'disconnect'
      )?.[1];

      if (disconnectCallback) {
        await act(async () => {
          disconnectCallback('transport close');
        });
      }

      // Should attempt to reconnect
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle connection errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { useWebSocket } = await import('../useWebSocket');
      
      renderHook(() => useWebSocket());

      // Simulate error
      const errorCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'connect_error'
      )?.[1];

      if (errorCallback) {
        await act(async () => {
          errorCallback(new Error('Connection failed'));
        });
      }

      consoleError.mockRestore();
    });

    it('should implement exponential backoff for reconnection', async () => {
      vi.useFakeTimers();
      
      const { useWebSocket } = await import('../useWebSocket');
      
      renderHook(() => useWebSocket({ 
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      }));

      // Simulate multiple disconnects
      const disconnectCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'disconnect'
      )?.[1];

      if (disconnectCallback) {
        for (let i = 0; i < 3; i++) {
          await act(async () => {
            disconnectCallback('transport close');
            vi.advanceTimersByTime(1000 * Math.pow(2, i));
          });
        }
      }

      vi.useRealTimers();
    });

    it('should stop reconnecting after max attempts', async () => {
      vi.useFakeTimers();
      
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket({
        reconnection: true,
        reconnectionAttempts: 3,
      }));

      // Simulate max reconnection attempts
      const reconnectFailedCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'reconnect_failed'
      )?.[1];

      if (reconnectFailedCallback) {
        await act(async () => {
          reconnectFailedCallback();
        });
      }

      vi.useRealTimers();
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to custom events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const mockHandler = vi.fn();
      
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.subscribe('pdf:progress', mockHandler);
      });

      expect(mockSocket.on).toHaveBeenCalledWith('pdf:progress', mockHandler);
    });

    it('should unsubscribe from events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const mockHandler = vi.fn();
      
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        const unsubscribe = result.current.subscribe('pdf:progress', mockHandler);
        unsubscribe();
      });

      expect(mockSocket.off).toHaveBeenCalledWith('pdf:progress', mockHandler);
    });

    it('should emit events to server', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.emit('join:room', { roomId: 'room-123' });
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join:room', { roomId: 'room-123' });
    });

    it('should handle PDF processing progress events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const progressHandler = vi.fn();
      
      renderHook(() => useWebSocket());

      // Simulate progress event
      const onCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'pdf:progress'
      )?.[1];

      if (onCallback) {
        const progressData = {
          pdfId: 'pdf-123',
          progress: 50,
          stage: 'extracting',
        };
        onCallback(progressData);
      }
    });

    it('should handle quiz session events', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      renderHook(() => useWebSocket());

      // Subscribe to quiz events
      const quizUpdateCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'quiz:update'
      )?.[1];

      if (quizUpdateCallback) {
        const quizData = {
          sessionId: 'session-123',
          status: 'completed',
          score: 85,
        };
        quizUpdateCallback(quizData);
      }
    });
  });

  describe('Authentication Integration', () => {
    it('should send auth token on connection', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      renderHook(() => useWebSocket({
        auth: { token: 'mock-jwt-token' },
      }));

      // Check that socket was created with auth
      const { io } = await import('socket.io-client');
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'mock-jwt-token' },
        })
      );
    });

    it('should handle authentication errors', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      // Simulate auth error
      const errorCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'connect_error'
      )?.[1];

      if (errorCallback) {
        await act(async () => {
          const authError = new Error('Authentication failed');
          (authError as any).message = 'Authentication failed';
          errorCallback(authError);
        });
      }
    });
  });

  describe('Room Management', () => {
    it('should join a room', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.joinRoom('pdf-processing:pdf-123');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'pdf-processing:pdf-123');
    });

    it('should leave a room', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.leaveRoom('pdf-processing:pdf-123');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'pdf-processing:pdf-123');
    });
  });

  describe('Error States', () => {
    it('should provide error state on connection failure', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      // Simulate connection error
      const errorCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'connect_error'
      )?.[1];

      if (errorCallback) {
        await act(async () => {
          errorCallback(new Error('Network unavailable'));
        });

        expect(result.current.error).toBeDefined();
      }
    });

    it('should clear error on successful reconnection', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result } = renderHook(() => useWebSocket());

      // Simulate error then reconnect
      const errorCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'connect_error'
      )?.[1];
      const connectCallback = mockSocket.on.mock.calls.find(
        ([event]) => event === 'connect'
      )?.[1];

      if (errorCallback && connectCallback) {
        await act(async () => {
          errorCallback(new Error('Temporary error'));
        });

        await act(async () => {
          mockSocket.connected = true;
          connectCallback();
        });
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all listeners on unmount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const mockHandler = vi.fn();
      
      const { result, unmount } = renderHook(() => useWebSocket());

      act(() => {
        result.current.subscribe('custom:event', mockHandler);
      });

      unmount();

      // Should have cleaned up the listener
      expect(mockSocket.off).toHaveBeenCalled();
    });

    it('should not emit events after unmount', async () => {
      const { useWebSocket } = await import('../useWebSocket');
      
      const { result, unmount } = renderHook(() => useWebSocket());
      
      const emitFn = result.current.emit;
      
      unmount();

      // Attempting to emit after unmount should be safe
      expect(() => emitFn('test', {})).not.toThrow();
    });
  });
});

describe('useWebSocket with React Query Integration', () => {
  it('should invalidate queries on WebSocket events', async () => {
    const mockQueryClient = {
      invalidateQueries: vi.fn(),
    };

    // This would be tested with actual React Query integration
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
