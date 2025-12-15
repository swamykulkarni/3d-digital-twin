import * as THREE from 'three';
import { modelLoader, MeshPanelMapping } from './modelLoader.js';
import { resourceManager } from './resourceManager.js';

/**
 * Loading priority levels
 */
export enum LoadingPriority {
  CRITICAL = 0,  // Essential geometry, always loaded first
  HIGH = 1,      // Important details, loaded second
  MEDIUM = 2,    // Standard details, loaded third
  LOW = 3        // Optional details, loaded last
}

/**
 * Progressive loading chunk
 */
export interface LoadingChunk {
  id: string;
  priority: LoadingPriority;
  meshes: THREE.Mesh[];
  estimatedSize: number;
  loaded: boolean;
}

/**
 * Progressive loading options
 */
export interface ProgressiveLoadingOptions {
  maxConcurrentChunks: number;
  chunkSizeLimit: number; // bytes
  priorityDelayMs: number;
  enablePreloading: boolean;
  distanceBasedLoading: boolean;
}

/**
 * Service for progressive loading of complex 3D scenes
 */
export class ProgressiveLoaderService {
  private loadingQueue: LoadingChunk[] = [];
  private activeLoads: Set<string> = new Set();
  private loadedChunks: Map<string, LoadingChunk> = new Map();
  private camera: THREE.Camera | null = null;
  private scene: THREE.Scene | null = null;
  
  private options: ProgressiveLoadingOptions = {
    maxConcurrentChunks: 3,
    chunkSizeLimit: 5 * 1024 * 1024, // 5MB
    priorityDelayMs: 100,
    enablePreloading: true,
    distanceBasedLoading: true
  };

  private onProgressCallback?: (loaded: number, total: number) => void;
  private onChunkLoadedCallback?: (chunk: LoadingChunk) => void;

  /**
   * Initialize progressive loader
   */
  initialize(scene: THREE.Scene, camera: THREE.Camera): void {
    this.scene = scene;
    this.camera = camera;
    console.log('Progressive loader initialized');
  }

  /**
   * Load a model progressively
   */
  async loadModelProgressively(
    gltfUrl: string,
    projectId: string,
    onProgress?: (loaded: number, total: number) => void,
    onChunkLoaded?: (chunk: LoadingChunk) => void
  ): Promise<{ scene: THREE.Scene; meshPanelMappings: MeshPanelMapping[] }> {
    this.onProgressCallback = onProgress;
    this.onChunkLoadedCallback = onChunkLoaded;

    try {
      console.log(`Starting progressive loading: ${gltfUrl}`);
      
      // Load the full model first to analyze it
      const modelResult = await modelLoader.loadModel(gltfUrl, projectId);
      
      // Analyze and chunk the model
      const chunks = this.analyzeAndChunkModel(modelResult.scene);
      
      // Sort chunks by priority
      chunks.sort((a, b) => a.priority - b.priority);
      
      // Add to loading queue
      this.loadingQueue = chunks;
      
      // Start progressive loading
      await this.processLoadingQueue();
      
      console.log(`Progressive loading completed: ${chunks.length} chunks loaded`);
      
      return {
        scene: modelResult.scene,
        meshPanelMappings: modelResult.meshPanelMappings
      };
    } catch (error) {
      console.error('Progressive loading failed:', error);
      throw error;
    }
  }

  /**
   * Analyze model and create loading chunks
   */
  private analyzeAndChunkModel(scene: THREE.Scene): LoadingChunk[] {
    const chunks: LoadingChunk[] = [];
    const meshes: THREE.Mesh[] = [];
    
    // Collect all meshes
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshes.push(object);
      }
    });
    
    console.log(`Analyzing ${meshes.length} meshes for progressive loading`);
    
    // Group meshes by priority and size
    const priorityGroups = this.groupMeshesByPriority(meshes);
    
    // Create chunks for each priority group
    Object.entries(priorityGroups).forEach(([priority, groupMeshes]) => {
      const priorityLevel = parseInt(priority) as LoadingPriority;
      const priorityChunks = this.createChunksFromMeshes(groupMeshes, priorityLevel);
      chunks.push(...priorityChunks);
    });
    
    return chunks;
  }

  /**
   * Group meshes by loading priority
   */
  private groupMeshesByPriority(meshes: THREE.Mesh[]): Record<LoadingPriority, THREE.Mesh[]> {
    const groups: Record<LoadingPriority, THREE.Mesh[]> = {
      [LoadingPriority.CRITICAL]: [],
      [LoadingPriority.HIGH]: [],
      [LoadingPriority.MEDIUM]: [],
      [LoadingPriority.LOW]: []
    };
    
    meshes.forEach((mesh) => {
      const priority = this.determineMeshPriority(mesh);
      groups[priority].push(mesh);
    });
    
    return groups;
  }

  /**
   * Determine loading priority for a mesh
   */
  private determineMeshPriority(mesh: THREE.Mesh): LoadingPriority {
    // Check mesh name for priority hints
    const name = mesh.name.toLowerCase();
    
    if (name.includes('structure') || name.includes('foundation') || name.includes('core')) {
      return LoadingPriority.CRITICAL;
    }
    
    if (name.includes('panel') || name.includes('facade') || name.includes('wall')) {
      return LoadingPriority.HIGH;
    }
    
    if (name.includes('detail') || name.includes('trim') || name.includes('fixture')) {
      return LoadingPriority.MEDIUM;
    }
    
    // Check geometry complexity
    const triangleCount = this.getTriangleCount(mesh);
    if (triangleCount > 10000) {
      return LoadingPriority.HIGH;
    } else if (triangleCount > 1000) {
      return LoadingPriority.MEDIUM;
    }
    
    return LoadingPriority.LOW;
  }

  /**
   * Get triangle count for a mesh
   */
  private getTriangleCount(mesh: THREE.Mesh): number {
    const geometry = mesh.geometry;
    if (geometry.index) {
      return geometry.index.count / 3;
    } else if (geometry.attributes.position) {
      return geometry.attributes.position.count / 3;
    }
    return 0;
  }

  /**
   * Create chunks from meshes based on size limits
   */
  private createChunksFromMeshes(meshes: THREE.Mesh[], priority: LoadingPriority): LoadingChunk[] {
    const chunks: LoadingChunk[] = [];
    let currentChunk: THREE.Mesh[] = [];
    let currentSize = 0;
    
    meshes.forEach((mesh) => {
      const meshSize = this.estimateMeshSize(mesh);
      
      // Start new chunk if size limit exceeded
      if (currentSize + meshSize > this.options.chunkSizeLimit && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, priority, currentSize));
        currentChunk = [];
        currentSize = 0;
      }
      
      currentChunk.push(mesh);
      currentSize += meshSize;
    });
    
    // Add remaining meshes as final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, priority, currentSize));
    }
    
    return chunks;
  }

  /**
   * Create a loading chunk
   */
  private createChunk(meshes: THREE.Mesh[], priority: LoadingPriority, size: number): LoadingChunk {
    return {
      id: `chunk_${priority}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      priority,
      meshes: [...meshes],
      estimatedSize: size,
      loaded: false
    };
  }

  /**
   * Estimate memory size of a mesh
   */
  private estimateMeshSize(mesh: THREE.Mesh): number {
    let size = 0;
    
    // Geometry size
    if (mesh.geometry) {
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        if (attribute instanceof THREE.BufferAttribute) {
          size += attribute.array.byteLength;
        }
      }
      if (mesh.geometry.index) {
        size += mesh.geometry.index.array.byteLength;
      }
    }
    
    // Material size (rough estimate)
    size += 1024;
    
    return size;
  }

  /**
   * Process the loading queue
   */
  private async processLoadingQueue(): Promise<void> {
    const totalChunks = this.loadingQueue.length;
    let loadedCount = 0;
    
    while (this.loadingQueue.length > 0 || this.activeLoads.size > 0) {
      // Start new loads if under concurrent limit
      while (
        this.activeLoads.size < this.options.maxConcurrentChunks && 
        this.loadingQueue.length > 0
      ) {
        const chunk = this.loadingQueue.shift()!;
        this.loadChunk(chunk);
      }
      
      // Wait for at least one load to complete
      await this.waitForChunkCompletion();
      
      // Update progress
      loadedCount = this.loadedChunks.size;
      this.onProgressCallback?.(loadedCount, totalChunks);
    }
  }

  /**
   * Load a single chunk
   */
  private async loadChunk(chunk: LoadingChunk): Promise<void> {
    this.activeLoads.add(chunk.id);
    
    try {
      console.log(`Loading chunk ${chunk.id} (priority: ${chunk.priority}, meshes: ${chunk.meshes.length})`);
      
      // Simulate progressive loading by initially hiding meshes
      chunk.meshes.forEach((mesh) => {
        mesh.visible = false;
        
        // Register mesh with resource manager
        resourceManager.registerResource(mesh, 'mesh', `mesh_${mesh.uuid}`);
        
        if (mesh.geometry) {
          resourceManager.registerResource(mesh.geometry, 'geometry', `geo_${mesh.geometry.uuid}`);
        }
        
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material, index) => {
            resourceManager.registerResource(material, 'material', `mat_${mesh.uuid}_${index}`);
          });
        }
      });
      
      // Add delay based on priority
      const delay = chunk.priority * this.options.priorityDelayMs;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Make meshes visible (simulate loading completion)
      chunk.meshes.forEach((mesh) => {
        mesh.visible = true;
      });
      
      chunk.loaded = true;
      this.loadedChunks.set(chunk.id, chunk);
      
      console.log(`Chunk ${chunk.id} loaded successfully`);
      this.onChunkLoadedCallback?.(chunk);
      
    } catch (error) {
      console.error(`Failed to load chunk ${chunk.id}:`, error);
    } finally {
      this.activeLoads.delete(chunk.id);
    }
  }

  /**
   * Wait for at least one chunk to complete loading
   */
  private async waitForChunkCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.activeLoads.size < this.options.maxConcurrentChunks || this.loadingQueue.length === 0) {
          resolve();
        } else {
          setTimeout(checkCompletion, 50);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Update loading based on camera distance (distance-based loading)
   */
  updateDistanceBasedLoading(): void {
    if (!this.options.distanceBasedLoading || !this.camera || !this.scene) {
      return;
    }
    
    const cameraPosition = this.camera.position;
    
    this.loadedChunks.forEach((chunk) => {
      chunk.meshes.forEach((mesh) => {
        const distance = cameraPosition.distanceTo(mesh.position);
        
        // Hide distant low-priority objects
        if (chunk.priority >= LoadingPriority.MEDIUM && distance > 100) {
          mesh.visible = false;
        } else if (chunk.priority >= LoadingPriority.LOW && distance > 50) {
          mesh.visible = false;
        } else {
          mesh.visible = true;
        }
      });
    });
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): {
    totalChunks: number;
    loadedChunks: number;
    activeLoads: number;
    queuedChunks: number;
    totalSize: number;
    loadedSize: number;
  } {
    const totalChunks = this.loadedChunks.size + this.loadingQueue.length + this.activeLoads.size;
    const totalSize = Array.from(this.loadedChunks.values()).reduce((sum, chunk) => sum + chunk.estimatedSize, 0) +
                     this.loadingQueue.reduce((sum, chunk) => sum + chunk.estimatedSize, 0);
    const loadedSize = Array.from(this.loadedChunks.values()).reduce((sum, chunk) => sum + chunk.estimatedSize, 0);
    
    return {
      totalChunks,
      loadedChunks: this.loadedChunks.size,
      activeLoads: this.activeLoads.size,
      queuedChunks: this.loadingQueue.length,
      totalSize,
      loadedSize
    };
  }

  /**
   * Update progressive loading options
   */
  updateOptions(newOptions: Partial<ProgressiveLoadingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log('Progressive loading options updated:', this.options);
  }

  /**
   * Get current options
   */
  getOptions(): ProgressiveLoadingOptions {
    return { ...this.options };
  }

  /**
   * Reset progressive loader
   */
  reset(): void {
    this.loadingQueue = [];
    this.activeLoads.clear();
    this.loadedChunks.clear();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.reset();
    this.scene = null;
    this.camera = null;
    this.onProgressCallback = undefined;
    this.onChunkLoadedCallback = undefined;
  }
}

// Export singleton instance
export const progressiveLoader = new ProgressiveLoaderService();