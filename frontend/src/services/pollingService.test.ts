import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingService } from './pollingService.js';
import { statusApi } from './api.js';

// Mock the API
vi.mock('./api.js', () => ({
  statusApi: {
    getProjectStatus: vi.fn()
  }
}));

// Mock timers
vi.useFakeTimers();

describe('PollingService', () => {
  let pollingService: PollingService;
  let mockCallbacks: any;

  beforeEach(() => {
    pollingService = new PollingService({
      interval: 1000, // 1 second for testing
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffDelay: 10000,
      reducedInterval: 5000
    });

    mockCallbacks = {
      onData: vi.fn(),
      onError: vi.fn(),
      onRetry: vi.fn()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    pollingService.stop();
    vi.clearAllTimers();
  });

  it('should start polling and fetch data successfully', async () => {
    const mockData = [{ id: 'PNL-01-001', status: 'INSTALLED' }];
    vi.mocked(statusApi.getProjectStatus).mockResolvedValue(mockData);

    pollingService.start('TestProject', mockCallbacks);

    // Wait for initial fetch
    await vi.runOnlyPendingTimersAsync();

    expect(statusApi.getProjectStatus).toHaveBeenCalledWith('TestProject');
    expect(mockCallbacks.onData).toHaveBeenCalledWith(mockData);
    expect(mockCallbacks.onError).not.toHaveBeenCalled();
  });

  it('should implement exponential backoff on errors', async () => {
    const error = new Error('Network error');
    vi.mocked(statusApi.getProjectStatus).mockRejectedValue(error);

    pollingService.start('TestProject', mockCallbacks);

    // Initial fetch should fail
    await vi.runOnlyPendingTimersAsync();
    expect(mockCallbacks.onError).toHaveBeenCalledWith(error);
    expect(mockCallbacks.onRetry).toHaveBeenCalledWith(1, expect.any(Number));

    // Should retry with exponential backoff
    await vi.runOnlyPendingTimersAsync();
    expect(mockCallbacks.onRetry).toHaveBeenCalledWith(2, expect.any(Number));
  });

  it('should update project ID correctly', async () => {
    const mockData = [{ id: 'PNL-01-001', status: 'INSTALLED' }];
    vi.mocked(statusApi.getProjectStatus).mockResolvedValue(mockData);

    pollingService.start('Project1', mockCallbacks);
    await vi.runOnlyPendingTimersAsync();

    expect(statusApi.getProjectStatus).toHaveBeenCalledWith('Project1');

    // Update project
    pollingService.updateProject('Project2');
    await vi.runOnlyPendingTimersAsync();

    expect(statusApi.getProjectStatus).toHaveBeenCalledWith('Project2');
  });

  it('should stop polling when stop is called', async () => {
    const mockData = [{ id: 'PNL-01-001', status: 'INSTALLED' }];
    vi.mocked(statusApi.getProjectStatus).mockResolvedValue(mockData);

    pollingService.start('TestProject', mockCallbacks);
    
    // Let initial fetch complete
    await vi.runOnlyPendingTimersAsync();
    const initialCallCount = vi.mocked(statusApi.getProjectStatus).mock.calls.length;
    
    pollingService.stop();

    // Advance timers - should not make any more calls after stop
    await vi.runOnlyPendingTimersAsync();
    
    expect(vi.mocked(statusApi.getProjectStatus).mock.calls.length).toBe(initialCallCount);
  });

  it('should provide correct status information', () => {
    const status = pollingService.getStatus();
    expect(status).toEqual({
      isActive: false,
      isTabVisible: true,
      currentRetryCount: 0,
      projectId: null
    });

    pollingService.start('TestProject', mockCallbacks);
    const activeStatus = pollingService.getStatus();
    expect(activeStatus.isActive).toBe(true);
    expect(activeStatus.projectId).toBe('TestProject');
  });
});