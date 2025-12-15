import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AzureStorageService } from './azureStorage';

describe('AzureStorageService', () => {
  let azureStorage: AzureStorageService;

  beforeEach(() => {
    azureStorage = new AzureStorageService({
      containerName: 'test-models',
      enableCache: true,
      cacheMaxSize: 50,
      cacheMaxAge: 60 * 60 * 1000
    });
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = azureStorage.getConfig();
      expect(config.containerName).toBe('test-models');
      expect(config.enableCache).toBe(true);
      expect(config.cacheMaxSize).toBe(50);
    });

    it('should update configuration', () => {
      azureStorage.updateConfig({
        cacheMaxSize: 100,
        enableCache: false
      });

      const config = azureStorage.getConfig();
      expect(config.cacheMaxSize).toBe(100);
      expect(config.enableCache).toBe(false);
    });
  });

  describe('Model URL Generation (Demo Mode)', () => {
    it('should return mock URLs for known projects', async () => {
      const url = await azureStorage.getModelUrl('BuildingA');
      expect(url).toBe('/models/building-a.gltf');
    });

    it('should throw error for unknown projects', async () => {
      await expect(azureStorage.getModelUrl('UnknownProject')).rejects.toThrow(
        'No model available for project: UnknownProject'
      );
    });
  });

  describe('Model Existence Check (Demo Mode)', () => {
    it('should return true for known projects', async () => {
      const exists = await azureStorage.modelExists('BuildingA');
      expect(exists).toBe(true);
    });

    it('should return false for unknown projects', async () => {
      const exists = await azureStorage.modelExists('UnknownProject');
      expect(exists).toBe(false);
    });
  });

  describe('Model Listing (Demo Mode)', () => {
    it('should list available models', async () => {
      const models = await azureStorage.listModels();
      expect(models).toContain('BuildingA.gltf');
      expect(models).toContain('BuildingB.gltf');
    });

    it('should list models for specific project', async () => {
      const models = await azureStorage.listModels('BuildingA');
      expect(models).toContain('BuildingA.gltf');
    });
  });

  describe('Model Metadata (Demo Mode)', () => {
    it('should return mock metadata for projects', async () => {
      const metadata = await azureStorage.getModelMetadata('BuildingA');
      expect(metadata).toBeDefined();
      expect(metadata?.size).toBe(1024 * 1024); // 1MB mock size
      expect(metadata?.contentType).toBe('model/gltf+json');
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = azureStorage.getCacheStats();
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('totalSizeMB');
      expect(typeof stats.entries).toBe('number');
      expect(typeof stats.totalSizeMB).toBe('number');
    });

    it('should clear cache', () => {
      azureStorage.clearCache();
      const stats = azureStorage.getCacheStats();
      expect(stats.entries).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });
  });

  describe('Retry Configuration', () => {
    it('should update retry configuration', () => {
      azureStorage.updateRetryConfig({
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000
      });

      // Configuration is updated internally, no direct way to verify
      // but the method should not throw
      expect(() => azureStorage.updateRetryConfig({ maxRetries: 3 })).not.toThrow();
    });
  });

  describe('Connection Testing (Demo Mode)', () => {
    it('should return false when not initialized with real credentials', async () => {
      const connected = await azureStorage.testConnection();
      expect(connected).toBe(false);
    });
  });
});