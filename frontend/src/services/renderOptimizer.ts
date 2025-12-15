import * as THREE from 'three';
import { performanceMonitor, PerformanceMetrics } from './performanceMonitor.js';

/**
 * Level of Detail (LOD) configuration
 */
export interface LODConfig {
  distances: number[];
  geometryReductions: number[]; // Percentage reduction for each LOD level
  materialSimplifications: boolean[];
}

/**
 * Optimization settings
 */
export interface OptimizationSettings {
  enableLOD: boolean;
  enableFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
  maxDrawCalls: number;
  targetFPS: number;
  adaptiveQuality: boolean;
}

/**
 * Service for optimizing Three.js rendering performance for large models
 */
export class RenderOptimizerService {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private lodObjects: Map<THREE.Object3D, THREE.LOD> = new Map();
  private frustum = new THREE.Frustum();
  private cameraMatrix = new THREE.Matrix4();
  
  private settings: OptimizationSettings = {
    enableLOD: true,
    enableFrustumCulling: true,
    enableOcclusionCulling: false, // Expensive, disabled by default
    maxDrawCalls: 100,
    targetFPS: 30,
    adaptiveQuality: true
  };

  private defaultLODConfig: LODConfig = {
    distances: [0, 20, 50, 100],
    geometryReductions: [0, 0.5, 0.75, 0.9],
    materialSimplifications: [false, false, true, true]
  };

  /**
   * Initialize the render optimizer
   */
  initialize(
    renderer: THREE.WebGLRenderer, 
    scene: THREE.Scene, 
    camera: THREE.Camera
  ): void {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    this.setupRendererOptimizations();
    console.log('Render optimizer initialized');
  }

  /**
   * Setup basic renderer optimizations
   */
  private setupRendererOptimizations(): void {
    if (!this.renderer) return;

    // Enable hardware-accelerated features
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Optimize shadow settings
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Enable frustum culling
    this.renderer.frustumCulled = true;
    
    // Optimize rendering order
    this.renderer.sortObjects = true;
  }
  /**
   * Create LOD (Level of Detail) for a mesh to optimize rendering at distance
   */
  createLODForMesh(
    mesh: THREE.Mesh, 
    config: LODConfig = this.defaultLODConfig
  ): THREE.LOD {
    const lod = new THREE.LOD();
    
    // Add original mesh as highest detail level
    lod.addLevel(mesh, config.distances[0]);
    
    // Create simplified versions for each LOD level
    for (let i = 1; i < config.distances.length; i++) {
      const simplifiedMesh = this.createSimplifiedMesh(
        mesh, 
        config.geometryReductions[i],
        config.materialSimplifications[i]
      );
      
      if (simplifiedMesh) {
        lod.addLevel(simplifiedMesh, config.distances[i]);
      }
    }
    
    this.lodObjects.set(mesh, lod);
    return lod;
  }

  /**
   * Create a simplified version of a mesh
   */
  private createSimplifiedMesh(
    originalMesh: THREE.Mesh,
    geometryReduction: number,
    simplifyMaterial: boolean
  ): THREE.Mesh | null {
    try {
      let geometry = originalMesh.geometry.clone();
      
      // Simplify geometry if reduction is specified
      if (geometryReduction > 0) {
        geometry = this.simplifyGeometry(geometry, geometryReduction);
      }
      
      // Simplify material if requested
      let material = originalMesh.material;
      if (simplifyMaterial) {
        material = this.simplifyMaterial(material);
      }
      
      const simplifiedMesh = new THREE.Mesh(geometry, material);
      simplifiedMesh.userData = { ...originalMesh.userData, isLOD: true };
      
      return simplifiedMesh;
    } catch (error) {
      console.warn('Failed to create simplified mesh:', error);
      return null;
    }
  }

  /**
   * Simplify geometry by reducing vertex count
   */
  private simplifyGeometry(
    geometry: THREE.BufferGeometry, 
    reduction: number
  ): THREE.BufferGeometry {
    // Simple decimation - remove every nth vertex
    // In a production system, you'd use a proper mesh simplification algorithm
    const positions = geometry.attributes.position;
    const indices = geometry.index;
    
    if (!positions || !indices) {
      return geometry;
    }
    
    const targetCount = Math.floor(indices.count * (1 - reduction));
    const step = Math.max(1, Math.floor(indices.count / targetCount));
    
    const newIndices: number[] = [];
    for (let i = 0; i < indices.count; i += step) {
      newIndices.push(indices.getX(i));
    }
    
    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.computeVertexNormals();
    
    return newGeometry;
  }

  /**
   * Create a simplified material
   */
  private simplifyMaterial(material: THREE.Material | THREE.Material[]): THREE.Material {
    if (Array.isArray(material)) {
      // Use the first material and simplify it
      material = material[0];
    }
    
    if (material instanceof THREE.MeshStandardMaterial) {
      // Create a basic material with just color
      return new THREE.MeshBasicMaterial({
        color: material.color,
        transparent: material.transparent,
        opacity: material.opacity
      });
    }
    
    return material;
  }

  /**
   * Apply LOD to all meshes in the scene
   */
  applyLODToScene(config: LODConfig = this.defaultLODConfig): void {
    if (!this.scene) return;
    
    const meshes: THREE.Mesh[] = [];
    
    // Collect all meshes
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && !object.userData.isLOD) {
        meshes.push(object);
      }
    });
    
    console.log(`Applying LOD to ${meshes.length} meshes`);
    
    // Replace meshes with LOD versions
    meshes.forEach((mesh) => {
      const lod = this.createLODForMesh(mesh, config);
      
      // Replace mesh with LOD in the scene
      if (mesh.parent) {
        mesh.parent.add(lod);
        mesh.parent.remove(mesh);
      }
    });
  }

  /**
   * Perform frustum culling to hide objects outside camera view
   */
  performFrustumCulling(): void {
    if (!this.camera || !this.scene) return;
    
    // Update frustum from camera
    this.cameraMatrix.multiplyMatrices(
      this.camera.projectionMatrix, 
      this.camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    
    // Test objects against frustum
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = this.frustum.intersectsObject(object);
      }
    });
  }

  /**
   * Optimize rendering based on current performance
   */
  adaptiveOptimization(): void {
    if (!this.settings.adaptiveQuality) return;
    
    const metrics = performanceMonitor.getCurrentMetrics();
    if (!metrics) return;
    
    const fps = metrics.renderingStats.fps;
    const targetFPS = this.settings.targetFPS;
    
    if (fps < targetFPS * 0.8) {
      // Performance is poor, reduce quality
      this.reduceQuality();
    } else if (fps > targetFPS * 1.2) {
      // Performance is good, can increase quality
      this.increaseQuality();
    }
  }

  /**
   * Reduce rendering quality to improve performance
   */
  private reduceQuality(): void {
    if (!this.renderer) return;
    
    // Reduce pixel ratio
    const currentPixelRatio = this.renderer.getPixelRatio();
    if (currentPixelRatio > 1) {
      this.renderer.setPixelRatio(Math.max(1, currentPixelRatio * 0.8));
      console.log('Reduced pixel ratio for performance');
    }
    
    // Disable shadows if enabled
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      console.log('Disabled shadows for performance');
    }
  }

  /**
   * Increase rendering quality when performance allows
   */
  private increaseQuality(): void {
    if (!this.renderer) return;
    
    const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
    const currentPixelRatio = this.renderer.getPixelRatio();
    
    // Increase pixel ratio
    if (currentPixelRatio < maxPixelRatio) {
      this.renderer.setPixelRatio(Math.min(maxPixelRatio, currentPixelRatio * 1.1));
      console.log('Increased pixel ratio');
    }
    
    // Enable shadows if disabled
    if (!this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = true;
      console.log('Enabled shadows');
    }
  }

  /**
   * Update optimization settings
   */
  updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('Render optimization settings updated:', this.settings);
  }

  /**
   * Get current optimization settings
   */
  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Optimize the entire scene
   */
  optimizeScene(): void {
    if (this.settings.enableLOD) {
      this.applyLODToScene();
    }
    
    if (this.settings.enableFrustumCulling) {
      this.performFrustumCulling();
    }
    
    this.adaptiveOptimization();
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    lodObjects: number;
    visibleObjects: number;
    totalObjects: number;
    currentPixelRatio: number;
  } {
    let visibleObjects = 0;
    let totalObjects = 0;
    
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          totalObjects++;
          if (object.visible) {
            visibleObjects++;
          }
        }
      });
    }
    
    return {
      lodObjects: this.lodObjects.size,
      visibleObjects,
      totalObjects,
      currentPixelRatio: this.renderer?.getPixelRatio() || 1
    };
  }

  /**
   * Reset all optimizations
   */
  reset(): void {
    this.lodObjects.clear();
    
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
    }
    
    if (this.scene) {
      this.scene.traverse((object) => {
        object.visible = true;
      });
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.reset();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}

// Export singleton instance
export const renderOptimizer = new RenderOptimizerService();