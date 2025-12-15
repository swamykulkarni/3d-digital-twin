import { StatusApiResponse, PanelDetailsResponse, PanelStatus } from '../types/index.js';

// Use relative URL in production, localhost in development
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8888/api';

export interface ApiRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  isRetryable: boolean;
  originalError?: Error;
}

/**
 * API client for panel status data with comprehensive error handling
 */
export class StatusApiClient {
  private retryConfig: ApiRetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  };

  /**
   * Fetch all panel statuses for a project with retry logic
   */
  async getProjectStatus(projectId: string): Promise<PanelStatus[]> {
    return this.withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/status?project=${projectId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) {
        throw this.createApiError(
          `Failed to fetch project status: ${response.statusText}`,
          response.status,
          response.status >= 500 || response.status === 429 // Retry on server errors and rate limits
        );
      }
      
      const data: StatusApiResponse = await response.json();
      
      // Validate response structure
      if (!data || !Array.isArray(data.panels)) {
        throw this.createApiError(
          'Invalid response format from status API',
          response.status,
          false
        );
      }
      
      return data.panels;
    }, 'getProjectStatus');
  }

  /**
   * Fetch detailed status for a specific panel with retry logic
   */
  async getPanelDetails(panelId: string): Promise<PanelDetailsResponse> {
    return this.withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/status/${panelId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw this.createApiError(
          `Failed to fetch panel details: ${response.statusText}`,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }
      
      return await response.json();
    }, 'getPanelDetails');
  }

  /**
   * Update panel status with retry logic
   */
  async updatePanelStatus(panelId: string, status: Partial<PanelStatus>): Promise<void> {
    return this.withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/status/${panelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(status),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw this.createApiError(
          `Failed to update panel status: ${response.statusText}`,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }
    }, 'updatePanelStatus');
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn('API connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Generic retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: ApiError | undefined;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Log successful recovery if this wasn't the first attempt
        if (attempt > 0) {
          console.log(`${operationName} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = this.normalizeError(error);
        
        // Log detailed error information for debugging
        console.error(`${operationName} attempt ${attempt + 1} failed:`, {
          message: lastError.message,
          status: lastError.status,
          isNetworkError: lastError.isNetworkError,
          isRetryable: lastError.isRetryable
        });

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt === this.retryConfig.maxRetries || !lastError.isRetryable) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );

        console.log(`Retrying ${operationName} in ${delay}ms (attempt ${attempt + 2}/${this.retryConfig.maxRetries + 1})`);
        await this.sleep(delay);
      }
    }

    throw lastError || this.createApiError('Operation failed after all retries', undefined, false);
  }

  /**
   * Create standardized API error
   */
  private createApiError(message: string, status?: number, isRetryable: boolean = false): ApiError {
    const error = new Error(message) as ApiError;
    error.status = status;
    error.isNetworkError = !status || status === 0;
    error.isRetryable = isRetryable || error.isNetworkError;
    return error;
  }

  /**
   * Normalize different error types into ApiError
   */
  private normalizeError(error: any): ApiError {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return this.createApiError('Request timeout', 0, true);
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return this.createApiError('Network connection failed', 0, true);
    }

    if (error.status !== undefined) {
      return error as ApiError;
    }

    // Generic network error
    const apiError = this.createApiError(
      error.message || 'Unknown API error',
      undefined,
      true
    );
    apiError.originalError = error;
    return apiError;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<ApiRetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}

// Export singleton instance
export const statusApi = new StatusApiClient();