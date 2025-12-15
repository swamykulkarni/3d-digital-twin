# Azure Blob Storage Integration

This document describes the Azure Blob Storage integration implemented for the 3D Digital Twin application.

## Overview

The Azure Blob Storage integration provides secure, scalable storage for GLTF 3D model files with intelligent caching and comprehensive error handling. The system supports both production Azure Storage and demo mode for development.

## Key Features Implemented

### 1. Secure Access Configuration
- **SAS Token Generation**: Automatic generation of time-limited SAS tokens for secure file access
- **Credential Management**: Support for both connection strings and account name/key authentication
- **Environment-based Configuration**: Flexible configuration system supporting development and production environments

### 2. Intelligent Caching Strategy
- **Memory-based Caching**: In-memory cache for frequently accessed models with configurable size limits
- **Cache Expiration**: Time-based cache expiration with automatic cleanup
- **Cache Statistics**: Real-time monitoring of cache usage and hit rates
- **Size Management**: Automatic eviction of oldest entries when cache size limits are exceeded

### 3. Comprehensive Error Handling
- **Retry Logic**: Exponential backoff retry strategy for transient failures
- **Network Error Detection**: Intelligent detection and handling of network-related errors
- **Graceful Degradation**: Fallback to demo mode when Azure Storage is unavailable
- **Detailed Error Logging**: Comprehensive error logging for debugging and monitoring

## Implementation Details

### Core Service: `AzureStorageService`

Located in `frontend/src/services/azureStorage.ts`, this service provides:

```typescript
// Key methods implemented:
- getModelUrl(projectId, fileName?): Promise<string>
- downloadModel(projectId, fileName?, onProgress?): Promise<ArrayBuffer>
- modelExists(projectId, fileName?): Promise<boolean>
- listModels(projectId?): Promise<string[]>
- getModelMetadata(projectId, fileName?): Promise<ModelMetadata>
- testConnection(): Promise<boolean>
```

### Configuration System

Located in `frontend/src/config/azureConfig.ts`:

```typescript
interface AzureConfig {
  accountName?: string;
  accountKey?: string;
  connectionString?: string;
  containerName: string;
  enableCache: boolean;
  cacheMaxSize: number; // in MB
  cacheMaxAge: number; // in milliseconds
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}
```

### Integration with Model Loader

Enhanced `ModelLoaderService` in `frontend/src/services/modelLoader.ts`:

- **Direct Azure Loading**: `loadModelFromStorage()` method for direct Azure Blob Storage access
- **Progress Tracking**: Real-time download progress reporting
- **Caching Integration**: Automatic use of cached model data when available
- **Blob URL Management**: Proper cleanup of temporary blob URLs

## Usage Examples

### Production Configuration

Set environment variables:
```bash
REACT_APP_AZURE_STORAGE_ACCOUNT=your-storage-account
REACT_APP_AZURE_STORAGE_KEY=your-storage-key
REACT_APP_AZURE_CONTAINER=models
```

### Programmatic Usage

```javascript
import { azureStorage } from './services/azureStorage';

// Check if model exists
const exists = await azureStorage.modelExists('BuildingA');

// Get secure model URL
const url = await azureStorage.getModelUrl('BuildingA');

// Download model with progress tracking
const arrayBuffer = await azureStorage.downloadModel('BuildingA', 'model.gltf', 
  (progress) => console.log(`Download: ${Math.round(progress * 100)}%`)
);

// Get cache statistics
const stats = azureStorage.getCacheStats();
console.log(`Cache: ${stats.entries} entries, ${stats.totalSizeMB.toFixed(2)} MB`);
```

## Security Features

### SAS Token Security
- **Time-limited Access**: SAS tokens expire after 1 hour by default
- **Read-only Permissions**: Tokens are generated with read-only access
- **Automatic Renewal**: New tokens generated automatically when needed

### Credential Protection
- **Environment Variables**: Sensitive credentials stored in environment variables
- **Safe Configuration**: Configuration methods exclude sensitive data from logs
- **Demo Mode Fallback**: Graceful operation without credentials for development

## Caching Strategy

### Cache Behavior
- **Automatic Caching**: Models under size limit are automatically cached
- **LRU Eviction**: Least recently used items are evicted when cache is full
- **Expiration Management**: Expired entries are automatically removed
- **Memory Monitoring**: Real-time tracking of cache memory usage

### Cache Configuration
```javascript
// Default cache settings
{
  enableCache: true,
  cacheMaxSize: 100, // 100MB
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
}
```

## Error Handling & Recovery

### Retry Strategy
- **Exponential Backoff**: Delays increase exponentially between retries
- **Configurable Limits**: Maximum retry count and delay limits
- **Error Classification**: Different handling for network vs. service errors

### Fallback Mechanisms
- **Demo Mode**: Automatic fallback to mock data when Azure Storage unavailable
- **Graceful Degradation**: Application continues to function with reduced capabilities
- **User Feedback**: Clear error messages and status indicators

## Testing

Comprehensive test suite in `frontend/src/services/azureStorage.test.ts`:

- **Configuration Testing**: Validation of configuration management
- **Demo Mode Testing**: Verification of fallback behavior
- **Cache Management**: Testing of cache operations and cleanup
- **Error Scenarios**: Validation of error handling and recovery

## Performance Optimizations

### Efficient Loading
- **Streaming Downloads**: Large files downloaded in chunks with progress tracking
- **Parallel Operations**: Multiple model operations can run concurrently
- **Smart Caching**: Frequently accessed models served from memory

### Resource Management
- **Memory Cleanup**: Automatic cleanup of temporary resources
- **Connection Pooling**: Efficient reuse of Azure Storage connections
- **Bandwidth Optimization**: Conditional downloads based on cache status

## Monitoring & Debugging

### Logging
- **Detailed Error Logs**: Comprehensive error information for debugging
- **Operation Tracking**: Logging of all major operations and their outcomes
- **Performance Metrics**: Cache hit rates and operation timing

### Development Tools
- **Cache Statistics**: Real-time cache usage monitoring
- **Connection Testing**: Built-in connectivity testing
- **Configuration Validation**: Automatic validation of configuration settings

## Future Enhancements

### Planned Features
- **CDN Integration**: Azure CDN support for global model distribution
- **Compression**: Automatic compression/decompression of model files
- **Versioning**: Support for model versioning and rollback
- **Batch Operations**: Bulk upload/download capabilities

### Scalability Improvements
- **Worker Threads**: Background processing for large model operations
- **Progressive Loading**: Streaming and progressive model loading
- **Edge Caching**: Integration with edge computing for reduced latency

## Conclusion

The Azure Blob Storage integration provides a robust, secure, and scalable solution for 3D model storage and retrieval. The implementation includes comprehensive error handling, intelligent caching, and graceful fallback mechanisms to ensure reliable operation in both development and production environments.

The system is designed to be production-ready while maintaining ease of development through its demo mode capabilities and comprehensive testing suite.