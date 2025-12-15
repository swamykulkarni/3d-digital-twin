import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { extractPanelIdFromMeshName, validatePanelId } from '../utils/panelId.js';
import { errorRecoveryService } from './errorRecoveryService.js';
import { azureStorage } from './azureStorage.js';
import { resourceManager } from './resourceManager.js';
import { ModelMetadata } from '../types/index.js';

/**
 * Interface for mesh-to-Panel ID mapping
 */
export interface MeshPanelMapping {
  mesh: THREE.Mesh;
  panelId: string;
}

/**
 * Result of GLTF model loading and validation
 */
export interface ModelLoadResult {
  scene: THREE.Scene;
  meshPanelMappings: MeshPanelMapping[];
  metadata: ModelMetadata;
  warnings: string[];
}

/**
 * Service for loading and parsing GLTF models with Panel ID extraction and Azure Storage integration
 */
export class ModelLoaderService {
  private loader: GLTFLoader;
  private loadingProgress: Map<string, number> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load GLTF model from URL and extract Panel ID mappings with comprehensive error handling
   */
  async loadModel(gltfUrl: string, projectId: string): Promise<ModelLoadResult> {
    try {
      console.log(`Loading GLTF model from: ${gltfUrl}`);
      
      // Validate URL format
      if (!this.isValidUrl(gltfUrl)) {
        throw new Error(`Invalid GLTF URL format: ${gltfUrl}`);
      }
      
      const gltf = await this.loadGLTF(gltfUrl, projectId);
      
      // Validate GLTF structure before processing
      const validation = this.validateModel(gltf);
      if (!validation.isValid) {
        throw new Error(`Invalid GLTF model: ${validation.errors.join(', ')}`);
      }
      
      const result = this.processModel(gltf, gltfUrl, projectId);
      
      console.log(`Model loaded successfully. Found ${result.meshPanelMappings.length} panel meshes.`);
      
      // Report successful storage operation to error recovery service
      errorRecoveryService.reportStorageSuccess();
      
      if (result.warnings.length > 0) {
        console.warn(`Model loading completed with ${result.warnings.length} warnings:`, result.warnings);
      }
      
      return result;
    } catch (error) {
      const errorMessage = `Failed to load GLTF model from ${gltfUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Report storage error to error recovery service
      errorRecoveryService.reportStorageError(errorMessage);
      
      console.error('Model loading error details:', {
        url: gltfUrl,
        projectId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Load GLTF model directly from Azure Storage with caching
   */
  async loadModelFromStorage(projectId: string, fileName?: string, onProgress?: (progress: number) => void): Promise<ModelLoadResult> {
    try {
      console.log(`Loading GLTF model from Azure Storage: ${projectId}/${fileName || projectId + '.gltf'}`);
      
      // Check if model exists first
      const exists = await azureStorage.modelExists(projectId, fileName);
      if (!exists) {
        throw new Error(`Model file not found in Azure Storage: ${projectId}/${fileName || projectId + '.gltf'}`);
      }

      // Download model data with caching
      const arrayBuffer = await azureStorage.downloadModel(projectId, fileName, onProgress);
      
      // Convert ArrayBuffer to Blob URL for Three.js loader
      const blob = new Blob([arrayBuffer], { type: 'model/gltf+json' });
      const blobUrl = URL.createObjectURL(blob);
      
      try {
        const gltf = await this.loadGLTF(blobUrl, projectId);
        
        // Validate GLTF structure before processing
        const validation = this.validateModel(gltf);
        if (!validation.isValid) {
          throw new Error(`Invalid GLTF model: ${validation.errors.join(', ')}`);
        }
        
        const result = this.processModel(gltf, blobUrl, projectId);
        
        console.log(`Model loaded from Azure Storage successfully. Found ${result.meshPanelMappings.length} panel meshes.`);
        
        // Report successful storage operation to error recovery service
        errorRecoveryService.reportStorageSuccess();
        
        if (result.warnings.length > 0) {
          console.warn(`Model loading completed with ${result.warnings.length} warnings:`, result.warnings);
        }
        
        return result;
      } finally {
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      const errorMessage = `Failed to load GLTF model from Azure Storage ${projectId}/${fileName || projectId + '.gltf'}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Report storage error to error recovery service
      errorRecoveryService.reportStorageError(errorMessage);
      
      console.error('Azure Storage model loading error details:', {
        projectId,
        fileName,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Load GLTF file using Three.js GLTFLoader with timeout and error handling
   */
  private loadGLTF(url: string, projectId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up timeout for loading
      const timeout = setTimeout(() => {
        reject(new Error(`GLTF loading timeout after 60 seconds for URL: ${url}`));
      }, 60000);

      // Track loading progress for this project
      if (projectId) {
        this.loadingProgress.set(projectId, 0);
      }

      this.loader.load(
        url,
        (gltf) => {
          clearTimeout(timeout);
          
          // Basic validation of loaded GLTF
          if (!gltf || !gltf.scene) {
            reject(new Error('Loaded GLTF is missing scene data'));
            return;
          }
          
          // Complete loading progress
          if (projectId) {
            this.loadingProgress.set(projectId, 1.0);
          }
          
          console.log('GLTF loaded successfully');
          resolve(gltf);
        },
        (progress) => {
          if (progress.total > 0) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            const progressRatio = progress.loaded / progress.total;
            
            // Update loading progress
            if (projectId) {
              this.loadingProgress.set(projectId, progressRatio);
            }
            
            console.log(`Loading progress: ${percentage}% (${progress.loaded}/${progress.total} bytes)`);
          }
        },
        (error) => {
          clearTimeout(timeout);
          
          // Clear loading progress on error
          if (projectId) {
            this.loadingProgress.delete(projectId);
          }
          
          // Enhance error message with more context
          let errorMessage = 'Failed to load GLTF model';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          // Add specific error context based on common failure modes
          if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            errorMessage = `GLTF file not found at URL: ${url}`;
          } else if (errorMessage.includes('CORS')) {
            errorMessage = `CORS error loading GLTF from: ${url}. Check server CORS configuration.`;
          } else if (errorMessage.includes('network')) {
            errorMessage = `Network error loading GLTF from: ${url}. Check internet connection.`;
          }
          
          reject(new Error(errorMessage));
        }
      );
    });
  }

  /**
   * Process loaded GLTF model and extract Panel ID mappings
   */
  private processModel(gltf: any, gltfUrl: string, projectId: string): ModelLoadResult {
    const scene = gltf.scene;
    const meshPanelMappings: MeshPanelMapping[] = [];
    const warnings: string[] = [];
    const panelIds: string[] = [];

    // Traverse the scene to find all meshes
    scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        const meshName = object.name;
        
        if (!meshName) {
          warnings.push(`Found mesh without name - skipping Panel ID extraction`);
          return;
        }

        const panelId = extractPanelIdFromMeshName(meshName);
        
        if (panelId) {
          if (validatePanelId(panelId)) {
            meshPanelMappings.push({
              mesh: object,
              panelId: panelId
            });
            
            // Track unique panel IDs
            if (!panelIds.includes(panelId)) {
              panelIds.push(panelId);
            }
          } else {
            warnings.push(`Invalid Panel ID format in mesh "${meshName}": ${panelId}`);
          }
        } else {
          warnings.push(`Mesh "${meshName}" does not contain valid Panel ID format - will use default material`);
        }
      }
    });

    // Validate that we found at least some panel meshes
    if (meshPanelMappings.length === 0) {
      warnings.push('No valid panel meshes found in GLTF model - check mesh naming conventions');
    }

    // Create metadata
    const metadata: ModelMetadata = {
      projectId,
      gltfUrl,
      panelCount: panelIds.length,
      panelIds: panelIds.sort(), // Sort for consistent ordering
      uploadDate: new Date(),
      version: '1.0.0'
    };

    return {
      scene,
      meshPanelMappings,
      metadata,
      warnings
    };
  }

  /**
   * Validate GLTF model structure and mesh naming
   */
  validateModel(gltf: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!gltf || !gltf.scene) {
      errors.push('Invalid GLTF structure - missing scene');
      return { isValid: false, errors };
    }

    let meshCount = 0;
    let validPanelMeshCount = 0;

    gltf.scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        meshCount++;
        
        if (object.name) {
          const panelId = extractPanelIdFromMeshName(object.name);
          if (panelId && validatePanelId(panelId)) {
            validPanelMeshCount++;
          }
        }
      }
    });

    if (meshCount === 0) {
      errors.push('No meshes found in GLTF model');
    }

    if (validPanelMeshCount === 0) {
      errors.push('No valid panel meshes found - check mesh naming conventions (expected format: PNL-XX-XXX)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create mapping from Panel ID to meshes (handles duplicate Panel IDs)
   */
  createPanelIdToMeshesMap(mappings: MeshPanelMapping[]): Map<string, THREE.Mesh[]> {
    const panelIdToMeshes = new Map<string, THREE.Mesh[]>();

    mappings.forEach(mapping => {
      const existingMeshes = panelIdToMeshes.get(mapping.panelId) || [];
      existingMeshes.push(mapping.mesh);
      panelIdToMeshes.set(mapping.panelId, existingMeshes);
    });

    return panelIdToMeshes;
  }

  /**
   * Get all unique Panel IDs from mappings
   */
  getUniquePanelIds(mappings: MeshPanelMapping[]): string[] {
    const uniqueIds = new Set<string>();
    mappings.forEach(mapping => uniqueIds.add(mapping.panelId));
    return Array.from(uniqueIds).sort();
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.toLowerCase().endsWith('.gltf') || url.toLowerCase().endsWith('.glb');
    } catch {
      return false;
    }
  }

  /**
   * Get loading progress for a project
   */
  getLoadingProgress(projectId: string): number {
    return this.loadingProgress.get(projectId) || 0;
  }

  /**
   * Clear loading progress for a project
   */
  clearLoadingProgress(projectId: string): void {
    this.loadingProgress.delete(projectId);
  }

  /**
   * List available models from Azure Storage
   */
  async listAvailableModels(projectId?: string): Promise<string[]> {
    try {
      return await azureStorage.listModels(projectId);
    } catch (error) {
      console.error('Error listing available models:', error);
      return [];
    }
  }

  /**
   * Get model metadata from Azure Storage
   */
  async getModelInfo(projectId: string, fileName?: string): Promise<{ size: number; lastModified: Date; contentType: string } | null> {
    try {
      return await azureStorage.getModelMetadata(projectId, fileName);
    } catch (error) {
      console.error('Error getting model metadata:', error);
      return null;
    }
  }

  /**
   * Check if model is cached
   */
  isModelCached(projectId: string, fileName?: string): boolean {
    const cacheStats = azureStorage.getCacheStats();
    return cacheStats.entries > 0; // Simplified check - could be more specific
  }

  /**
   * Preload model into cache without processing
   */
  async preloadModel(projectId: string, fileName?: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      console.log(`Preloading model into cache: ${projectId}/${fileName || projectId + '.gltf'}`);
      await azureStorage.downloadModel(projectId, fileName, onProgress);
      console.log(`Model preloaded successfully: ${projectId}/${fileName || projectId + '.gltf'}`);
    } catch (error) {
      console.error('Error preloading model:', error);
      throw error;
    }
  }

  /**
   * Dispose of Three.js resources to prevent memory leaks
   */
  disposeModel(scene: THREE.Scene): void {
    try {
      // Use resource manager for comprehensive disposal
      const sceneId = `scene_${scene.uuid}`;
      
      // Register scene with resource manager if not already registered
      if (!resourceManager.getResourceInfo(sceneId)) {
        resourceManager.registerResource(scene, 'scene', sceneId);
      }
      
      // Dispose through resource manager
      resourceManager.disposeResource(sceneId, true);
      
      console.log('Model resources disposed successfully through resource manager');
    } catch (error) {
      console.error('Error disposing model resources:', error);
      
      // Fallback to manual disposal
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                if (material.dispose) material.dispose();
              });
            } else {
              if (object.material.dispose) object.material.dispose();
            }
          }
        }
      });
    }
  }
}

// Export singleton instance
export const modelLoader = new ModelLoaderService();