import * as THREE from 'three';

/**
 * Resource tracking interface
 */
export interface ResourceInfo {
  id: string;
  type: 'geometry' | 'material' | 'texture' | 'mesh' | 'scene';
  size?: number;
  createdAt: number;
  lastUsed: number;
  refCount: number;
}

/**
 * Disposal options
 */
export interface DisposalOptions {
  force?: boolean;
  maxAge?: number; // milliseconds
  minRefCount?: number;
}

/**
 * Service for managing Three.js resource lifecycle and preventing memory leaks
 */
export class ResourceManagerService {
  private resources: Map<string, ResourceInfo> = new Map();
  private resourceObjects: Map<string, any> = new Map();
  private disposalQueue: Set<string> = new Set();
  private autoCleanupInterval: number | null = null;
  private isAutoCleanupEnabled = false;

  /**
   * Register a resource for tracking
   */
  registerResource(
    resource: THREE.Geometry | THREE.Material | THREE.Texture | THREE.Mesh | THREE.Scene,
    type: ResourceInfo['type'],
    id?: string
  ): string {
    const resourceId = id || this.generateResourceId(type);
    
    const info: ResourceInfo = {
      id: resourceId,
      type,
      size: this.estimateResourceSize(resource, type),
      createdAt: Date.now(),
      lastUsed: Date.now(),
      refCount: 1
    };

    this.resources.set(resourceId, info);
    this.resourceObjects.set(resourceId, resource);

    console.log(`Registered ${type} resource: ${resourceId} (${info.size} bytes)`);
    return resourceId;
  }

  /**
   * Increment reference count for a resource
   */
  addReference(resourceId: string): void {
    const info = this.resources.get(resourceId);
    if (info) {
      info.refCount++;
      info.lastUsed = Date.now();
    }
  }

  /**
   * Decrement reference count for a resource
   */
  removeReference(resourceId: string): void {
    const info = this.resources.get(resourceId);
    if (info) {
      info.refCount = Math.max(0, info.refCount - 1);
      
      // Queue for disposal if no references remain
      if (info.refCount === 0) {
        this.disposalQueue.add(resourceId);
      }
    }
  }

  /**
   * Update last used timestamp for a resource
   */
  touchResource(resourceId: string): void {
    const info = this.resources.get(resourceId);
    if (info) {
      info.lastUsed = Date.now();
    }
  }

  /**
   * Dispose of a specific resource
   */
  disposeResource(resourceId: string, force: boolean = false): boolean {
    const info = this.resources.get(resourceId);
    const resource = this.resourceObjects.get(resourceId);

    if (!info || !resource) {
      return false;
    }

    // Check if resource can be disposed
    if (!force && info.refCount > 0) {
      console.warn(`Cannot dispose resource ${resourceId}: still has ${info.refCount} references`);
      return false;
    }

    try {
      // Dispose based on resource type
      switch (info.type) {
        case 'geometry':
          if (resource instanceof THREE.BufferGeometry) {
            resource.dispose();
          }
          break;
        
        case 'material':
          if (resource instanceof THREE.Material) {
            resource.dispose();
          }
          break;
        
        case 'texture':
          if (resource instanceof THREE.Texture) {
            resource.dispose();
          }
          break;
        
        case 'mesh':
          if (resource instanceof THREE.Mesh) {
            this.disposeMesh(resource);
          }
          break;
        
        case 'scene':
          if (resource instanceof THREE.Scene) {
            this.disposeScene(resource);
          }
          break;
      }

      // Remove from tracking
      this.resources.delete(resourceId);
      this.resourceObjects.delete(resourceId);
      this.disposalQueue.delete(resourceId);

      console.log(`Disposed ${info.type} resource: ${resourceId}`);
      return true;
    } catch (error) {
      console.error(`Error disposing resource ${resourceId}:`, error);
      return false;
    }
  }

  /**
   * Dispose of a mesh and its associated resources
   */
  private disposeMesh(mesh: THREE.Mesh): void {
    // Dispose geometry
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    // Dispose materials
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(material => {
          if (material.dispose) {
            material.dispose();
          }
        });
      } else {
        if (mesh.material.dispose) {
          mesh.material.dispose();
        }
      }
    }

    // Remove from parent
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  }

  /**
   * Dispose of a scene and all its children
   */
  private disposeScene(scene: THREE.Scene): void {
    const objectsToDispose: THREE.Object3D[] = [];
    
    // Collect all objects first to avoid modifying during traversal
    scene.traverse((object) => {
      objectsToDispose.push(object);
    });

    // Dispose objects in reverse order (children first)
    objectsToDispose.reverse().forEach((object) => {
      if (object instanceof THREE.Mesh) {
        this.disposeMesh(object);
      } else if (object instanceof THREE.Light) {
        // Lights don't need special disposal
        if (object.parent) {
          object.parent.remove(object);
        }
      }
    });

    // Clear the scene
    scene.clear();
  }

  /**
   * Dispose of all resources in the disposal queue
   */
  processDisposalQueue(): number {
    const disposed: string[] = [];

    for (const resourceId of this.disposalQueue) {
      if (this.disposeResource(resourceId)) {
        disposed.push(resourceId);
      }
    }

    console.log(`Processed disposal queue: ${disposed.length} resources disposed`);
    return disposed.length;
  }

  /**
   * Clean up old or unused resources
   */
  cleanup(options: DisposalOptions = {}): number {
    const {
      force = false,
      maxAge = 5 * 60 * 1000, // 5 minutes default
      minRefCount = 0
    } = options;

    const now = Date.now();
    const toDispose: string[] = [];

    for (const [resourceId, info] of this.resources) {
      const age = now - info.lastUsed;
      const shouldDispose = force || 
        (info.refCount <= minRefCount && age > maxAge);

      if (shouldDispose) {
        toDispose.push(resourceId);
      }
    }

    let disposedCount = 0;
    toDispose.forEach(resourceId => {
      if (this.disposeResource(resourceId, force)) {
        disposedCount++;
      }
    });

    console.log(`Cleanup completed: ${disposedCount} resources disposed`);
    return disposedCount;
  }

  /**
   * Enable automatic cleanup at regular intervals
   */
  enableAutoCleanup(intervalMs: number = 60000, options: DisposalOptions = {}): void {
    if (this.isAutoCleanupEnabled) {
      this.disableAutoCleanup();
    }

    this.isAutoCleanupEnabled = true;
    this.autoCleanupInterval = window.setInterval(() => {
      this.cleanup(options);
      this.processDisposalQueue();
    }, intervalMs);

    console.log(`Auto cleanup enabled (interval: ${intervalMs}ms)`);
  }

  /**
   * Disable automatic cleanup
   */
  disableAutoCleanup(): void {
    if (this.autoCleanupInterval) {
      clearInterval(this.autoCleanupInterval);
      this.autoCleanupInterval = null;
    }
    this.isAutoCleanupEnabled = false;
    console.log('Auto cleanup disabled');
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): {
    totalResources: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    queuedForDisposal: number;
  } {
    const stats = {
      totalResources: this.resources.size,
      totalSize: 0,
      byType: {} as Record<string, { count: number; size: number }>,
      queuedForDisposal: this.disposalQueue.size
    };

    for (const info of this.resources.values()) {
      stats.totalSize += info.size || 0;
      
      if (!stats.byType[info.type]) {
        stats.byType[info.type] = { count: 0, size: 0 };
      }
      
      stats.byType[info.type].count++;
      stats.byType[info.type].size += info.size || 0;
    }

    return stats;
  }

  /**
   * Get detailed resource information
   */
  getResourceInfo(resourceId: string): ResourceInfo | null {
    return this.resources.get(resourceId) || null;
  }

  /**
   * List all resources of a specific type
   */
  getResourcesByType(type: ResourceInfo['type']): ResourceInfo[] {
    return Array.from(this.resources.values()).filter(info => info.type === type);
  }

  /**
   * Find resources that haven't been used recently
   */
  getStaleResources(maxAge: number = 5 * 60 * 1000): ResourceInfo[] {
    const now = Date.now();
    return Array.from(this.resources.values()).filter(info => {
      return (now - info.lastUsed) > maxAge;
    });
  }

  /**
   * Force dispose all resources
   */
  disposeAll(): void {
    const resourceIds = Array.from(this.resources.keys());
    
    resourceIds.forEach(resourceId => {
      this.disposeResource(resourceId, true);
    });

    console.log(`Force disposed all ${resourceIds.length} resources`);
  }

  /**
   * Generate a unique resource ID
   */
  private generateResourceId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate resource memory usage
   */
  private estimateResourceSize(resource: any, type: ResourceInfo['type']): number {
    try {
      switch (type) {
        case 'geometry':
          if (resource instanceof THREE.BufferGeometry) {
            let size = 0;
            for (const attribute of Object.values(resource.attributes)) {
              if (attribute instanceof THREE.BufferAttribute) {
                size += attribute.array.byteLength;
              }
            }
            if (resource.index) {
              size += resource.index.array.byteLength;
            }
            return size;
          }
          break;
        
        case 'texture':
          if (resource instanceof THREE.Texture && resource.image) {
            const width = resource.image.width || 512;
            const height = resource.image.height || 512;
            const channels = 4; // RGBA
            return width * height * channels;
          }
          break;
        
        case 'material':
          return 1024; // Rough estimate for material
        
        case 'mesh':
          return 512; // Rough estimate for mesh object
        
        case 'scene':
          return 256; // Rough estimate for scene object
      }
    } catch (error) {
      console.warn(`Error estimating size for ${type}:`, error);
    }
    
    return 0;
  }

  /**
   * Cleanup and dispose of the resource manager itself
   */
  dispose(): void {
    this.disableAutoCleanup();
    this.disposeAll();
    this.resources.clear();
    this.resourceObjects.clear();
    this.disposalQueue.clear();
  }
}

// Export singleton instance
export const resourceManager = new ResourceManagerService();