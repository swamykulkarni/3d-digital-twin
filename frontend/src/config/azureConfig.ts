/**
 * Azure Storage configuration for 3D Digital Twin application
 * 
 * This file demonstrates how to configure Azure Blob Storage for GLTF model hosting.
 * In production, sensitive values should be stored in environment variables.
 */

export interface AzureConfig {
  // Azure Storage Account Configuration
  accountName?: string;
  accountKey?: string;
  connectionString?: string;
  
  // Container and Security Settings
  containerName: string;
  sasTokenDuration: number; // in milliseconds
  
  // Caching Configuration
  enableCache: boolean;
  cacheMaxSize: number; // in MB
  cacheMaxAge: number; // in milliseconds
  
  // Performance Settings
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Get environment variable safely
 */
function getEnvVar(name: string): string | undefined {
  try {
    return (globalThis as any)?.process?.env?.[name] || (import.meta as any)?.env?.[name];
  } catch {
    return undefined;
  }
}

/**
 * Default Azure Storage configuration
 */
export const defaultAzureConfig: AzureConfig = {
  // Storage Account (set via environment variables in production)
  accountName: getEnvVar('REACT_APP_AZURE_STORAGE_ACCOUNT'),
  accountKey: getEnvVar('REACT_APP_AZURE_STORAGE_KEY'),
  connectionString: getEnvVar('REACT_APP_AZURE_STORAGE_CONNECTION_STRING'),
  
  // Container Settings
  containerName: getEnvVar('REACT_APP_AZURE_CONTAINER') || 'models',
  sasTokenDuration: 60 * 60 * 1000, // 1 hour
  
  // Caching Settings
  enableCache: true,
  cacheMaxSize: 100, // 100MB cache limit
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  
  // Retry Settings
  maxRetries: 3,
  baseDelay: 2000, // 2 seconds
  maxDelay: 60000, // 60 seconds
};

/**
 * Development configuration (uses mock data)
 */
export const developmentConfig: AzureConfig = {
  ...defaultAzureConfig,
  // No real Azure credentials for development
  accountName: undefined,
  accountKey: undefined,
  connectionString: undefined,
  
  // Reduced cache settings for development
  cacheMaxSize: 50, // 50MB
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
};

/**
 * Production configuration template
 */
export const productionConfigTemplate: AzureConfig = {
  // These should be set via environment variables:
  // REACT_APP_AZURE_STORAGE_ACCOUNT=your-storage-account
  // REACT_APP_AZURE_STORAGE_KEY=your-storage-key
  // REACT_APP_AZURE_CONTAINER=models
  
  accountName: getEnvVar('REACT_APP_AZURE_STORAGE_ACCOUNT'),
  accountKey: getEnvVar('REACT_APP_AZURE_STORAGE_KEY'),
  
  containerName: getEnvVar('REACT_APP_AZURE_CONTAINER') || 'models',
  sasTokenDuration: 60 * 60 * 1000, // 1 hour SAS token validity
  
  // Production caching settings
  enableCache: true,
  cacheMaxSize: 200, // 200MB for production
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  
  // Production retry settings
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * Get configuration based on environment
 */
export function getAzureConfig(): AzureConfig {
  const isDevelopment = getEnvVar('NODE_ENV') === 'development';
  
  if (isDevelopment) {
    return developmentConfig;
  }
  
  return defaultAzureConfig;
}

/**
 * Validate Azure configuration
 */
export function validateAzureConfig(config: AzureConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if we have either connection string or account name + key
  if (!config.connectionString && (!config.accountName || !config.accountKey)) {
    errors.push('Azure Storage requires either connectionString or accountName + accountKey');
  }
  
  // Validate container name
  if (!config.containerName || config.containerName.length < 3) {
    errors.push('Container name must be at least 3 characters long');
  }
  
  // Validate cache settings
  if (config.enableCache) {
    if (config.cacheMaxSize <= 0) {
      errors.push('Cache max size must be greater than 0');
    }
    
    if (config.cacheMaxAge <= 0) {
      errors.push('Cache max age must be greater than 0');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}