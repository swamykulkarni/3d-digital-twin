import { BlobServiceClient } from '@azure/storage-blob';

export interface StorageRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface StorageError extends Error {
  code?: string;
  statusCode?: number;
  isNetworkError: boolean;
  isRetryable: boolean;
  originalError?: Error;
}

export interface CacheEntry {
  url: string;
  data?: ArrayBuffer;
  timestamp: number;
  expiresAt: number;
  size?: number;
}

export interface AzureStorageConfig {
  accountName?: string;
  accountKey?: string;
  connectionString?: string;
  containerName?: string;
  sasToken?: string;
  enableCache?: boolean;
  cacheMaxSize?: number; // in MB
  cacheMaxAge?: number; // in milliseconds
}

/**
 * Azure Blob Storage service for GLTF model files with comprehensive error handling,
 * secure access, and intelligent caching
 */
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private config: AzureStorageConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private retryConfig: StorageRetryConfig = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2
  };

  constructor(config?: AzureStorageConfig) {
    this.config = {
      containerName: 'models',
      enableCache: true,
      cacheMaxSize: 100, // 100MB default
      cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours default
      ...config
    };

    if (config?.connectionString) {
      this.initializeFromConnectionString(config.connectionString);
    } else if (config?.accountName && config?.accountKey) {
      this.initializeFromCredentials(config.accountName, config.accountKey);
    }

    // Set up cache cleanup interval
    if (this.config.enableCache) {
      this.setupCacheCleanup();
    }
  }

  /**
   * Initialize from connection string
   */
  private initializeFromConnectionString(connectionString: string): void {
    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      console.log('Azure Storage service initialized with connection string');
    } catch (error) {
      console.error('Failed to initialize Azure Storage service:', error);
      throw this.createStorageError(
        'Failed to initialize Azure Storage service with connection string',
        error,
        false
      );
    }
  }

  /**
   * Initialize from account credentials for secure access
   */
  private initializeFromCredentials(accountName: string, accountKey: string): void {
    try {
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      this.blobServiceClient = new BlobServiceClient(accountUrl);
      console.log('Azure Storage service initialized with account URL');
    } catch (error) {
      console.error('Failed to initialize Azure Storage service with credentials:', error);
      throw this.createStorageError(
        'Failed to initialize Azure Storage service with credentials',
        error,
        false
      );
    }
  }

  /**
   * Initialize the service with new configuration
   */
  initialize(config: AzureStorageConfig): void {
    this.config = { ...this.config, ...config };
    
    if (config.connectionString) {
      this.initializeFromConnectionString(config.connectionString);
    } else if (config.accountName && config.accountKey) {
      this.initializeFromCredentials(config.accountName, config.accountKey);
    } else {
      throw this.createStorageError(
        'Azure Storage configuration requires either connectionString or accountName+accountKey',
        null,
        false
      );
    }
  }

  /**
   * Get GLTF model URL for a project with caching and secure access
   */
  async getModelUrl(projectId: string, fileName?: string): Promise<string | null> {
    const modelFileName = fileName || `${projectId}.gltf`;
    const cacheKey = `url:${projectId}:${modelFileName}`;

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getCachedEntry(cacheKey);
      if (cached?.url) {
        console.log(`Using cached URL for ${projectId}/${modelFileName}`);
        return cached.url;
      }
    }

    // If Azure Storage is not configured, return mock URLs for demo
    if (!this.blobServiceClient) {
      const mockUrls: Record<string, string | null> = {
        'BuildingA': '/models/building-a.gltf',
        'BuildingB': '/models/building-b.gltf',
        'ResidentialComplex': null // Use procedural building
      };

      const url = mockUrls[projectId];
      if (url === undefined) {
        throw this.createStorageError(
          `No model available for project: ${projectId}`,
          null,
          false
        );
      }
      
      // For ResidentialComplex, return null to trigger procedural building
      if (url === null) {
        return null;
      }

      // Cache the mock URL
      if (this.config.enableCache) {
        this.setCacheEntry(cacheKey, { url, timestamp: Date.now(), expiresAt: Date.now() + this.config.cacheMaxAge! });
      }

      return url;
    }

    // Get secure URL from Azure Storage
    return this.getSecureModelUrl(projectId, modelFileName, cacheKey);
  }

  /**
   * Get secure GLTF model URL from blob storage with SAS token
   */
  private async getSecureModelUrl(projectId: string, fileName: string, cacheKey: string): Promise<string> {
    return this.withRetry(async () => {
      const containerClient = this.blobServiceClient!.getContainerClient(this.config.containerName!);
      const blobClient = containerClient.getBlobClient(`${projectId}/${fileName}`);
      
      // Verify blob exists before generating SAS URL
      const exists = await blobClient.exists();
      if (!exists) {
        throw this.createStorageError(
          `Model file not found: ${projectId}/${fileName}`,
          null,
          false
        );
      }
      
      // Use direct URL (works for public containers or when using connection string)
      const secureUrl = blobClient.url;
      
      // Cache the secure URL
      if (this.config.enableCache) {
        this.setCacheEntry(cacheKey, {
          url: secureUrl,
          timestamp: Date.now(),
          expiresAt: Date.now() + (50 * 60 * 1000) // Cache for 50 minutes (less than SAS expiry)
        });
      }

      return secureUrl;
    }, 'getSecureModelUrl');
  }

  /**
   * Check if a model file exists in blob storage with retry logic
   */
  async modelExists(projectId: string, fileName?: string): Promise<boolean> {
    const modelFileName = fileName || `${projectId}.gltf`;

    if (!this.blobServiceClient) {
      // For demo mode, check mock URLs
      const mockUrls: Record<string, string> = {
        'BuildingA': '/models/building-a.gltf',
        'BuildingB': '/models/building-b.gltf',
        'ResidentialComplex': null // Use procedural building
      };
      return mockUrls.hasOwnProperty(projectId);
    }

    try {
      return await this.withRetry(async () => {
        const containerClient = this.blobServiceClient!.getContainerClient(this.config.containerName!);
        const blobClient = containerClient.getBlobClient(`${projectId}/${modelFileName}`);
        
        return await blobClient.exists();
      }, 'modelExists');
    } catch (error) {
      console.error('Error checking model existence:', error);
      return false;
    }
  }

  /**
   * Test Azure Storage connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.blobServiceClient) {
      return false;
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName!);
      await containerClient.getProperties();
      return true;
    } catch (error) {
      console.warn('Azure Storage connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Download model file with caching, progress tracking and retry logic
   */
  async downloadModel(projectId: string, fileName?: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    const modelFileName = fileName || `${projectId}.gltf`;
    const cacheKey = `data:${projectId}:${modelFileName}`;

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getCachedEntry(cacheKey);
      if (cached?.data) {
        console.log(`Using cached model data for ${projectId}/${modelFileName}`);
        if (onProgress) onProgress(1.0); // Report complete immediately
        return cached.data;
      }
    }

    if (!this.blobServiceClient) {
      throw this.createStorageError(
        'Azure Storage service not initialized - cannot download model files',
        null,
        false
      );
    }

    return this.withRetry(async () => {
      const containerClient = this.blobServiceClient!.getContainerClient(this.config.containerName!);
      const blobClient = containerClient.getBlobClient(`${projectId}/${modelFileName}`);
      
      // Get blob properties to check size
      const properties = await blobClient.getProperties();
      const totalSize = properties.contentLength || 0;
      
      if (totalSize === 0) {
        throw this.createStorageError(
          `Model file is empty: ${projectId}/${modelFileName}`,
          null,
          false
        );
      }

      // Check if file is too large for caching
      const maxCacheSizeMB = this.config.cacheMaxSize || 100;
      const maxCacheSizeBytes = maxCacheSizeMB * 1024 * 1024;
      const shouldCache = this.config.enableCache && totalSize <= maxCacheSizeBytes;

      // Download with progress tracking
      const downloadResponse = await blobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw this.createStorageError(
          'Failed to get readable stream from blob',
          null,
          true
        );
      }

      // Convert stream to ArrayBuffer with progress tracking
      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      
      const reader = downloadResponse.readableStreamBody.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          downloadedSize += value.length;
          
          if (onProgress && totalSize > 0) {
            onProgress(downloadedSize / totalSize);
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const arrayBuffer = result.buffer;

      // Cache the downloaded data if it's not too large
      if (shouldCache) {
        this.setCacheEntry(cacheKey, {
          url: '', // Not needed for data cache
          data: arrayBuffer,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.config.cacheMaxAge!,
          size: totalLength
        });
        console.log(`Cached model data for ${projectId}/${modelFileName} (${(totalLength / 1024 / 1024).toFixed(2)} MB)`);
      }

      return arrayBuffer;
    }, 'downloadModel');
  }

  /**
   * Generic retry wrapper with exponential backoff for storage operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: StorageError | undefined;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Log successful recovery if this wasn't the first attempt
        if (attempt > 0) {
          console.log(`Azure Storage ${operationName} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = this.normalizeStorageError(error);
        
        // Log detailed error information for debugging
        console.error(`Azure Storage ${operationName} attempt ${attempt + 1} failed:`, {
          message: lastError.message,
          code: lastError.code,
          statusCode: lastError.statusCode,
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

        console.log(`Retrying Azure Storage ${operationName} in ${delay}ms (attempt ${attempt + 2}/${this.retryConfig.maxRetries + 1})`);
        await this.sleep(delay);
      }
    }

    throw lastError || this.createStorageError('Operation failed after all retries', null, false);
  }

  /**
   * Create standardized storage error
   */
  private createStorageError(message: string, originalError: any, isRetryable: boolean): StorageError {
    const error = new Error(message) as StorageError;
    error.originalError = originalError;
    error.isRetryable = isRetryable;
    error.isNetworkError = this.isNetworkError(originalError);
    
    if (originalError) {
      error.code = originalError.code;
      error.statusCode = originalError.statusCode || originalError.status;
    }
    
    return error;
  }

  /**
   * Normalize different error types into StorageError
   */
  private normalizeStorageError(error: any): StorageError {
    if (error.isRetryable !== undefined) {
      return error as StorageError;
    }

    const isNetworkError = this.isNetworkError(error);
    const isRetryable = isNetworkError || this.isRetryableStorageError(error);

    return this.createStorageError(
      error.message || 'Unknown Azure Storage error',
      error,
      isRetryable
    );
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const networkErrorCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
    const networkErrorNames = ['NetworkError', 'TimeoutError', 'AbortError'];
    
    return networkErrorCodes.includes(error.code) || 
           networkErrorNames.includes(error.name) ||
           (error.message && error.message.includes('network'));
  }

  /**
   * Check if storage error is retryable
   */
  private isRetryableStorageError(error: any): boolean {
    if (!error) return false;
    
    // Retry on server errors (5xx) and throttling (429)
    if (error.statusCode >= 500 || error.statusCode === 429) {
      return true;
    }
    
    // Retry on specific Azure Storage error codes
    const retryableCodes = [
      'ServerBusy',
      'InternalError',
      'OperationTimedOut',
      'RequestTimeout'
    ];
    
    return retryableCodes.includes(error.code);
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
  updateRetryConfig(config: Partial<StorageRetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Cache management methods
   */
  private getCachedEntry(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  private setCacheEntry(key: string, entry: CacheEntry): void {
    // Clean up cache if it's getting too large
    this.cleanupCache();
    
    this.cache.set(key, entry);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxCacheSizeBytes = (this.config.cacheMaxSize || 100) * 1024 * 1024;
    let totalSize = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      } else {
        totalSize += entry.size || 0;
      }
    }

    // If still over limit, remove oldest entries
    if (totalSize > maxCacheSizeBytes) {
      const entries = Array.from(this.cache.entries())
        .filter(([, entry]) => entry.data) // Only consider data entries for size
        .sort(([, a], [, b]) => a.timestamp - b.timestamp); // Oldest first

      for (const [key, entry] of entries) {
        if (totalSize <= maxCacheSizeBytes) break;
        
        this.cache.delete(key);
        totalSize -= entry.size || 0;
        console.log(`Evicted cached entry: ${key} (${((entry.size || 0) / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  }

  private setupCacheCleanup(): void {
    // Clean up cache every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; totalSizeMB: number; hitRate?: number } {
    let totalSize = 0;
    let dataEntries = 0;

    for (const entry of this.cache.values()) {
      if (entry.data) {
        totalSize += entry.size || 0;
        dataEntries++;
      }
    }

    return {
      entries: this.cache.size,
      totalSizeMB: totalSize / 1024 / 1024
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Azure Storage cache cleared');
  }

  /**
   * List available models in the container
   */
  async listModels(projectId?: string): Promise<string[]> {
    if (!this.blobServiceClient) {
      // Return mock models for demo
      return projectId ? [`${projectId}.gltf`] : ['BuildingA.gltf', 'BuildingB.gltf', 'ResidentialComplex.gltf'];
    }

    try {
      return await this.withRetry(async () => {
        const containerClient = this.blobServiceClient!.getContainerClient(this.config.containerName!);
        const models: string[] = [];
        
        const prefix = projectId ? `${projectId}/` : '';
        
        for await (const blob of containerClient.listBlobsFlat({ prefix })) {
          if (blob.name.toLowerCase().endsWith('.gltf') || blob.name.toLowerCase().endsWith('.glb')) {
            models.push(blob.name);
          }
        }
        
        return models;
      }, 'listModels');
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }

  /**
   * Get model metadata without downloading the full file
   */
  async getModelMetadata(projectId: string, fileName?: string): Promise<{ size: number; lastModified: Date; contentType: string } | null> {
    const modelFileName = fileName || `${projectId}.gltf`;

    if (!this.blobServiceClient) {
      // Return mock metadata for demo
      return {
        size: 1024 * 1024, // 1MB mock size
        lastModified: new Date(),
        contentType: 'model/gltf+json'
      };
    }

    try {
      return await this.withRetry(async () => {
        const containerClient = this.blobServiceClient!.getContainerClient(this.config.containerName!);
        const blobClient = containerClient.getBlobClient(`${projectId}/${modelFileName}`);
        
        const properties = await blobClient.getProperties();
        
        return {
          size: properties.contentLength || 0,
          lastModified: properties.lastModified || new Date(),
          contentType: properties.contentType || 'application/octet-stream'
        };
      }, 'getModelMetadata');
    } catch (error) {
      console.error('Error getting model metadata:', error);
      return null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AzureStorageConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Clear cache if caching was disabled
    if (config.enableCache === false) {
      this.clearCache();
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<AzureStorageConfig, 'accountKey' | 'connectionString' | 'sasToken'> {
    const { accountKey, connectionString, sasToken, ...safeConfig } = this.config;
    return safeConfig;
  }
}

// Export singleton instance with default configuration
export const azureStorage = new AzureStorageService({
  containerName: 'models',
  enableCache: true,
  cacheMaxSize: 100, // 100MB
  cacheMaxAge: 24 * 60 * 60 * 1000 // 24 hours
});