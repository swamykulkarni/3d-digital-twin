import { statusApi } from './api.js';
import { azureStorage } from './azureStorage.js';

export interface ErrorState {
  hasApiError: boolean;
  hasStorageError: boolean;
  lastApiError?: string;
  lastStorageError?: string;
  apiErrorTime?: Date;
  storageErrorTime?: Date;
  recoveryAttempts: number;
  isRecovering: boolean;
}

export interface RecoveryCallbacks {
  onRecoveryStart: () => void;
  onRecoverySuccess: (service: 'api' | 'storage') => void;
  onRecoveryFailed: (service: 'api' | 'storage', error: string) => void;
  onFullRecovery: () => void;
}

/**
 * Service for coordinating error recovery across API and storage services
 */
export class ErrorRecoveryService {
  private errorState: ErrorState = {
    hasApiError: false,
    hasStorageError: false,
    recoveryAttempts: 0,
    isRecovering: false
  };

  private callbacks: RecoveryCallbacks = {
    onRecoveryStart: () => {},
    onRecoverySuccess: () => {},
    onRecoveryFailed: () => {},
    onFullRecovery: () => {}
  };

  private recoveryInterval: number | null = null;
  private readonly maxRecoveryAttempts = 10;
  private readonly recoveryCheckInterval = 30000; // 30 seconds
  private ignoreStorageErrors = false;

  /**
   * Register callbacks for recovery events
   */
  setCallbacks(callbacks: Partial<RecoveryCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Report API error
   */
  reportApiError(error: string): void {
    console.log('Error recovery service: API error reported -', error);
    
    this.errorState.hasApiError = true;
    this.errorState.lastApiError = error;
    this.errorState.apiErrorTime = new Date();
    
    this.startRecoveryIfNeeded();
  }

  /**
   * Set whether to ignore storage errors (useful for projects that don't use Azure Storage)
   */
  setIgnoreStorageErrors(ignore: boolean): void {
    this.ignoreStorageErrors = ignore;
    if (ignore && this.errorState.hasStorageError) {
      // Clear existing storage error if we're now ignoring them
      this.reportStorageSuccess();
    }
  }

  /**
   * Report storage error
   */
  reportStorageError(error: string): void {
    if (this.ignoreStorageErrors) {
      console.log('Error recovery service: Ignoring storage error for current project -', error);
      return;
    }
    
    console.log('Error recovery service: Storage error reported -', error);
    
    this.errorState.hasStorageError = true;
    this.errorState.lastStorageError = error;
    this.errorState.storageErrorTime = new Date();
    
    this.startRecoveryIfNeeded();
  }

  /**
   * Report successful API operation
   */
  reportApiSuccess(): void {
    if (this.errorState.hasApiError) {
      console.log('Error recovery service: API recovery successful');
      this.errorState.hasApiError = false;
      this.errorState.lastApiError = undefined;
      this.errorState.apiErrorTime = undefined;
      this.callbacks.onRecoverySuccess('api');
      
      this.checkFullRecovery();
    }
  }

  /**
   * Report successful storage operation
   */
  reportStorageSuccess(): void {
    if (this.errorState.hasStorageError) {
      console.log('Error recovery service: Storage recovery successful');
      this.errorState.hasStorageError = false;
      this.errorState.lastStorageError = undefined;
      this.errorState.storageErrorTime = undefined;
      this.callbacks.onRecoverySuccess('storage');
      
      this.checkFullRecovery();
    }
  }

  /**
   * Get current error state
   */
  getErrorState(): Readonly<ErrorState> {
    return { ...this.errorState };
  }

  /**
   * Check if system has any errors
   */
  hasErrors(): boolean {
    return this.errorState.hasApiError || this.errorState.hasStorageError;
  }

  /**
   * Force recovery attempt
   */
  async forceRecovery(): Promise<void> {
    if (this.errorState.isRecovering) {
      console.log('Recovery already in progress');
      return;
    }

    console.log('Forcing recovery attempt');
    await this.attemptRecovery();
  }

  /**
   * Stop recovery attempts
   */
  stopRecovery(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
    
    this.errorState.isRecovering = false;
    this.errorState.recoveryAttempts = 0;
  }

  /**
   * Start recovery process if not already running
   */
  private startRecoveryIfNeeded(): void {
    if (this.errorState.isRecovering || this.recoveryInterval) {
      return;
    }

    if (!this.hasErrors()) {
      return;
    }

    console.log('Starting error recovery process');
    this.errorState.isRecovering = true;
    this.errorState.recoveryAttempts = 0;
    this.callbacks.onRecoveryStart();

    // Start periodic recovery attempts
    this.recoveryInterval = window.setInterval(() => {
      this.attemptRecovery();
    }, this.recoveryCheckInterval);

    // Attempt immediate recovery
    this.attemptRecovery();
  }

  /**
   * Attempt to recover from errors
   */
  private async attemptRecovery(): Promise<void> {
    if (this.errorState.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.log('Max recovery attempts reached, stopping recovery');
      this.stopRecovery();
      return;
    }

    this.errorState.recoveryAttempts++;
    console.log(`Recovery attempt ${this.errorState.recoveryAttempts}/${this.maxRecoveryAttempts}`);

    // Test API connectivity if there's an API error
    if (this.errorState.hasApiError) {
      try {
        const apiConnected = await statusApi.testConnection();
        if (apiConnected) {
          this.reportApiSuccess();
        } else {
          console.log('API still not accessible');
          this.callbacks.onRecoveryFailed('api', 'API connectivity test failed');
        }
      } catch (error) {
        console.log('API recovery test failed:', error);
        this.callbacks.onRecoveryFailed('api', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Test storage connectivity if there's a storage error
    if (this.errorState.hasStorageError) {
      try {
        const storageConnected = await azureStorage.testConnection();
        if (storageConnected) {
          this.reportStorageSuccess();
        } else {
          console.log('Azure Storage still not accessible');
          this.callbacks.onRecoveryFailed('storage', 'Storage connectivity test failed');
        }
      } catch (error) {
        console.log('Storage recovery test failed:', error);
        this.callbacks.onRecoveryFailed('storage', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Check if full recovery is complete
   */
  private checkFullRecovery(): void {
    if (!this.hasErrors() && this.errorState.isRecovering) {
      console.log('Full recovery completed');
      this.stopRecovery();
      this.callbacks.onFullRecovery();
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyErrorMessage(): string {
    const errors: string[] = [];
    
    if (this.errorState.hasApiError) {
      errors.push('Unable to fetch panel status data');
    }
    
    if (this.errorState.hasStorageError) {
      errors.push('Unable to load 3D model files');
    }

    if (errors.length === 0) {
      return '';
    }

    let message = errors.join(' and ') + '.';
    
    if (this.errorState.isRecovering) {
      message += ` Attempting to reconnect... (${this.errorState.recoveryAttempts}/${this.maxRecoveryAttempts})`;
    } else {
      message += ' Please check your internet connection and try refreshing.';
    }

    return message;
  }

  /**
   * Get recovery status for UI display
   */
  getRecoveryStatus(): {
    isRecovering: boolean;
    attempts: number;
    maxAttempts: number;
    hasApiError: boolean;
    hasStorageError: boolean;
    message: string;
  } {
    return {
      isRecovering: this.errorState.isRecovering,
      attempts: this.errorState.recoveryAttempts,
      maxAttempts: this.maxRecoveryAttempts,
      hasApiError: this.errorState.hasApiError,
      hasStorageError: this.errorState.hasStorageError,
      message: this.getUserFriendlyErrorMessage()
    };
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();