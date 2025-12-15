import { statusApi } from './api.js';
import { errorRecoveryService } from './errorRecoveryService.js';
import { PanelStatus } from '../types/index.js';

export interface PollingConfig {
  interval: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
  reducedInterval: number; // for inactive tabs
}

export interface PollingCallbacks {
  onData: (data: PanelStatus[]) => void;
  onError: (error: Error) => void;
  onRetry: (attempt: number, delay: number) => void;
}

/**
 * Service for polling status data with exponential backoff and tab visibility detection
 */
export class PollingService {
  private config: PollingConfig;
  private callbacks: PollingCallbacks;
  private intervalId: number | null = null;
  private retryTimeoutId: number | null = null;
  private currentRetryCount = 0;
  private isActive = false;
  private isTabVisible = true;
  private projectId: string | null = null;

  constructor(config: Partial<PollingConfig> = {}) {
    this.config = {
      interval: 30000, // 30 seconds
      maxRetries: 5,
      backoffMultiplier: 2,
      maxBackoffDelay: 300000, // 5 minutes
      reducedInterval: 120000, // 2 minutes for inactive tabs
      ...config
    };

    this.callbacks = {
      onData: () => {},
      onError: () => {},
      onRetry: () => {}
    };

    // Set up tab visibility detection
    this.setupVisibilityDetection();
  }

  /**
   * Start polling for the given project
   */
  start(projectId: string, callbacks: PollingCallbacks): void {
    this.projectId = projectId;
    this.callbacks = callbacks;
    this.isActive = true;
    this.currentRetryCount = 0;

    // Initial fetch
    this.fetchData();

    // Start polling interval
    this.scheduleNextPoll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isActive = false;
    this.clearTimers();
  }

  /**
   * Update the project ID and restart polling
   */
  updateProject(projectId: string): void {
    if (this.projectId !== projectId) {
      this.projectId = projectId;
      this.currentRetryCount = 0;
      
      if (this.isActive) {
        this.clearTimers();
        this.fetchData();
        this.scheduleNextPoll();
      }
    }
  }

  /**
   * Force an immediate fetch (for manual refresh)
   */
  async refresh(): Promise<void> {
    if (this.projectId) {
      await this.fetchData();
    }
  }

  /**
   * Fetch data from API with retry logic and network recovery detection
   */
  private async fetchData(): Promise<void> {
    if (!this.projectId || !this.isActive) return;

    try {
      const data = await statusApi.getProjectStatus(this.projectId);
      
      // Check if this is a recovery from previous errors
      const wasInErrorState = this.currentRetryCount > 0;
      
      this.callbacks.onData(data);
      this.currentRetryCount = 0; // Reset retry count on success
      
      // Report successful API operation to error recovery service
      errorRecoveryService.reportApiSuccess();
      
      // Log recovery if we were previously failing
      if (wasInErrorState) {
        console.log('Network connectivity restored - polling resumed successfully');
      }
    } catch (error) {
      console.error('Polling error:', error);
      
      // Report API error to error recovery service
      const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
      errorRecoveryService.reportApiError(errorMessage);
      
      this.callbacks.onError(error as Error);
      
      if (this.currentRetryCount < this.config.maxRetries) {
        this.scheduleRetry();
      } else {
        // Max retries reached, continue with normal polling interval but with longer delay
        console.warn(`Max retries (${this.config.maxRetries}) reached. Continuing with extended polling interval.`);
        this.currentRetryCount = 0;
        this.scheduleNextPoll(true); // Use extended interval
      }
    }
  }

  /**
   * Schedule the next poll based on tab visibility and error state
   */
  private scheduleNextPoll(useExtendedInterval: boolean = false): void {
    if (!this.isActive) return;

    this.clearTimers();
    
    let interval = this.config.interval;
    
    if (useExtendedInterval) {
      // Use longer interval after max retries to avoid overwhelming the server
      interval = this.config.maxBackoffDelay;
    } else if (!this.isTabVisible) {
      interval = this.config.reducedInterval;
    }

    this.intervalId = window.setTimeout(() => {
      this.fetchData();
      this.scheduleNextPoll();
    }, interval);
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetry(): void {
    if (!this.isActive) return;

    this.currentRetryCount++;
    
    const baseDelay = this.config.interval;
    const backoffDelay = Math.min(
      baseDelay * Math.pow(this.config.backoffMultiplier, this.currentRetryCount - 1),
      this.config.maxBackoffDelay
    );

    this.callbacks.onRetry(this.currentRetryCount, backoffDelay);

    this.retryTimeoutId = window.setTimeout(() => {
      this.fetchData();
      if (this.currentRetryCount === 0) {
        // If successful, resume normal polling
        this.scheduleNextPoll();
      }
    }, backoffDelay);
  }

  /**
   * Clear all active timers
   */
  private clearTimers(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Set up tab visibility detection and network connectivity monitoring
   */
  private setupVisibilityDetection(): void {
    const handleVisibilityChange = () => {
      const wasVisible = this.isTabVisible;
      this.isTabVisible = !document.hidden;

      // If visibility changed and we're actively polling, reschedule
      if (wasVisible !== this.isTabVisible && this.isActive) {
        this.clearTimers();
        
        // If tab becomes visible and we were in error state, try immediate refresh
        if (this.isTabVisible && this.currentRetryCount > 0) {
          console.log('Tab became visible during error state - attempting immediate recovery');
          this.fetchData();
        }
        
        this.scheduleNextPoll();
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also listen for focus/blur events as fallback
    window.addEventListener('focus', () => {
      if (!this.isTabVisible) {
        this.isTabVisible = true;
        if (this.isActive) {
          this.clearTimers();
          
          // Try immediate refresh when window regains focus
          if (this.currentRetryCount > 0) {
            console.log('Window regained focus during error state - attempting immediate recovery');
            this.fetchData();
          }
          
          this.scheduleNextPoll();
        }
      }
    });

    window.addEventListener('blur', () => {
      if (this.isTabVisible) {
        this.isTabVisible = false;
        if (this.isActive) {
          this.clearTimers();
          this.scheduleNextPoll();
        }
      }
    });

    // Listen for online/offline events for network connectivity detection
    window.addEventListener('online', () => {
      console.log('Network connectivity restored');
      if (this.isActive && this.currentRetryCount > 0) {
        console.log('Attempting immediate recovery after network restoration');
        this.clearTimers();
        this.fetchData();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network connectivity lost');
      if (this.isActive) {
        this.callbacks.onError(new Error('Network connectivity lost'));
      }
    });
  }

  /**
   * Get current polling status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isTabVisible: this.isTabVisible,
      currentRetryCount: this.currentRetryCount,
      projectId: this.projectId
    };
  }
}

// Export singleton instance
export const pollingService = new PollingService();