import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatusPolling } from './useStatusPolling.js';
import { pollingService } from '../services/pollingService.js';

// Mock the polling service
vi.mock('../services/pollingService.js', () => ({
  pollingService: {
    start: vi.fn(),
    stop: vi.fn(),
    updateProject: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('useStatusPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useStatusPolling('TestProject'));

    expect(result.current.panelData).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.retryInfo).toEqual({
      isRetrying: false,
      retryCount: 0,
      nextRetryDelay: 0
    });
  });

  it('should start polling service on mount', () => {
    renderHook(() => useStatusPolling('TestProject'));

    expect(pollingService.start).toHaveBeenCalledWith('TestProject', expect.objectContaining({
      onData: expect.any(Function),
      onError: expect.any(Function),
      onRetry: expect.any(Function)
    }));
  });

  it('should stop polling service on unmount', () => {
    const { unmount } = renderHook(() => useStatusPolling('TestProject'));

    unmount();

    expect(pollingService.stop).toHaveBeenCalled();
  });

  it('should update project when projectId changes', () => {
    const { rerender } = renderHook(
      ({ projectId }) => useStatusPolling(projectId),
      { initialProps: { projectId: 'Project1' } }
    );

    rerender({ projectId: 'Project2' });

    expect(pollingService.updateProject).toHaveBeenCalledWith('Project2');
  });

  it('should handle data updates correctly', () => {
    const { result } = renderHook(() => useStatusPolling('TestProject'));

    // Get the onData callback that was passed to pollingService.start
    const startCall = vi.mocked(pollingService.start).mock.calls[0];
    const callbacks = startCall[1];
    const mockData = [{ id: 'PNL-01-001', status: 'INSTALLED' }];

    act(() => {
      callbacks.onData(mockData);
    });

    expect(result.current.panelData).toEqual(mockData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle errors correctly', () => {
    const { result } = renderHook(() => useStatusPolling('TestProject'));

    const startCall = vi.mocked(pollingService.start).mock.calls[0];
    const callbacks = startCall[1];
    const mockError = new Error('Network error');

    act(() => {
      callbacks.onError(mockError);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should handle retry information correctly', () => {
    const { result } = renderHook(() => useStatusPolling('TestProject'));

    const startCall = vi.mocked(pollingService.start).mock.calls[0];
    const callbacks = startCall[1];

    act(() => {
      callbacks.onRetry(2, 5000);
    });

    expect(result.current.retryInfo).toEqual({
      isRetrying: true,
      retryCount: 2,
      nextRetryDelay: 5000
    });
  });

  it('should call refresh on polling service', async () => {
    const { result } = renderHook(() => useStatusPolling('TestProject'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(pollingService.refresh).toHaveBeenCalled();
  });
});