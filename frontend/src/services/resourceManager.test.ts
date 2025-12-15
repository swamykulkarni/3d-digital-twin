import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resourceManager } from './resourceManager.js';
import * as THREE from 'three';

describe('ResourceManagerService', () => {
  beforeEach(() => {
    // Reset resource manager state
    resourceManager.disposeAll();
  });

  describe('Resource Registration', () => {
    it('should register a geometry resource', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      expect(resourceId).toBeTypeOf('string');
      expect(resourceId).toContain('geometry_');
      
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info?.type).toBe('geometry');
      expect(info?.refCount).toBe(1);
    });

    it('should register a material resource', () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const resourceId = resourceManager.registerResource(material, 'material');
      
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info?.type).toBe('material');
      expect(info?.refCount).toBe(1);
    });

    it('should register a mesh resource', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geometry, material);
      
      const resourceId = resourceManager.registerResource(mesh, 'mesh');
      
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info?.type).toBe('mesh');
      expect(info?.refCount).toBe(1);
    });
  });

  describe('Reference Counting', () => {
    it('should increment reference count', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      resourceManager.addReference(resourceId);
      
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info?.refCount).toBe(2);
    });

    it('should decrement reference count', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      resourceManager.removeReference(resourceId);
      
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info?.refCount).toBe(0);
    });

    it('should queue resource for disposal when ref count reaches zero', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      resourceManager.removeReference(resourceId);
      
      const stats = resourceManager.getResourceStats();
      expect(stats.queuedForDisposal).toBe(1);
    });
  });

  describe('Resource Disposal', () => {
    it('should dispose a resource with zero references', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      resourceManager.removeReference(resourceId);
      const disposed = resourceManager.disposeResource(resourceId);
      
      expect(disposed).toBe(true);
      expect(resourceManager.getResourceInfo(resourceId)).toBeNull();
    });

    it('should not dispose a resource with active references', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      const disposed = resourceManager.disposeResource(resourceId);
      
      expect(disposed).toBe(false);
      expect(resourceManager.getResourceInfo(resourceId)).toBeTruthy();
    });

    it('should force dispose a resource regardless of references', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      const disposed = resourceManager.disposeResource(resourceId, true);
      
      expect(disposed).toBe(true);
      expect(resourceManager.getResourceInfo(resourceId)).toBeNull();
    });
  });

  describe('Disposal Queue Processing', () => {
    it('should process disposal queue', () => {
      const geometry1 = new THREE.BoxGeometry(1, 1, 1);
      const geometry2 = new THREE.BoxGeometry(2, 2, 2);
      
      const id1 = resourceManager.registerResource(geometry1, 'geometry');
      const id2 = resourceManager.registerResource(geometry2, 'geometry');
      
      // Queue both for disposal
      resourceManager.removeReference(id1);
      resourceManager.removeReference(id2);
      
      const disposedCount = resourceManager.processDisposalQueue();
      
      expect(disposedCount).toBe(2);
      expect(resourceManager.getResourceInfo(id1)).toBeNull();
      expect(resourceManager.getResourceInfo(id2)).toBeNull();
    });
  });

  describe('Resource Statistics', () => {
    it('should provide accurate resource statistics', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      
      resourceManager.registerResource(geometry, 'geometry');
      resourceManager.registerResource(material, 'material');
      
      const stats = resourceManager.getResourceStats();
      
      expect(stats.totalResources).toBe(2);
      expect(stats.byType.geometry.count).toBe(1);
      expect(stats.byType.material.count).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old resources', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      // Remove reference to make it eligible for cleanup
      resourceManager.removeReference(resourceId);
      
      // Force cleanup regardless of age
      const cleanedCount = resourceManager.cleanup({ force: true });
      
      expect(cleanedCount).toBe(1);
      expect(resourceManager.getResourceInfo(resourceId)).toBeNull();
    });

    it('should find stale resources', async () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const resourceId = resourceManager.registerResource(geometry, 'geometry');
      
      // Wait a bit to ensure the resource has a lastUsed time
      const info = resourceManager.getResourceInfo(resourceId);
      expect(info).toBeTruthy();
      
      // Wait a small amount to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // All resources should be considered stale with maxAge 0
      const staleResources = resourceManager.getStaleResources(0);
      
      expect(staleResources.length).toBe(1);
      expect(staleResources[0].type).toBe('geometry');
    });
  });

  describe('Auto Cleanup', () => {
    it('should enable and disable auto cleanup', () => {
      resourceManager.enableAutoCleanup(100);
      // Auto cleanup is enabled, should not throw
      
      resourceManager.disableAutoCleanup();
      // Auto cleanup is disabled, should not throw
      
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Resource Queries', () => {
    it('should get resources by type', () => {
      const geometry1 = new THREE.BoxGeometry(1, 1, 1);
      const geometry2 = new THREE.SphereGeometry(1);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      
      resourceManager.registerResource(geometry1, 'geometry');
      resourceManager.registerResource(geometry2, 'geometry');
      resourceManager.registerResource(material, 'material');
      
      const geometries = resourceManager.getResourcesByType('geometry');
      const materials = resourceManager.getResourcesByType('material');
      
      expect(geometries.length).toBe(2);
      expect(materials.length).toBe(1);
    });
  });
});