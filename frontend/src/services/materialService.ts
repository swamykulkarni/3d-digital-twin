import * as THREE from 'three';
import { StatusType, PanelStatus } from '../types/index.js';
import { MATERIAL_CONFIG, DEFAULT_MATERIAL_COLOR } from '../constants/materials.js';

/**
 * Service for managing Three.js materials based on panel status
 */
export class MaterialService {
  private materialCache: Map<StatusType, THREE.MeshStandardMaterial> = new Map();
  private defaultMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.initializeMaterials();
  }

  /**
   * Initialize all status-based materials and cache them
   */
  private initializeMaterials(): void {
    // Create materials for each status type
    Object.values(StatusType).forEach(status => {
      const config = MATERIAL_CONFIG[status];
      if (config) {
        const material = new THREE.MeshStandardMaterial({
          color: config.color,
          metalness: 0.1,
          roughness: 0.7
        });
        this.materialCache.set(status, material);
      }
    });

    // Create default material for panels with no status data
    this.defaultMaterial = new THREE.MeshStandardMaterial({
      color: DEFAULT_MATERIAL_COLOR,
      metalness: 0.1,
      roughness: 0.7
    });
  }

  /**
   * Get material for a specific status type
   */
  getMaterialForStatus(status: StatusType | null | undefined): THREE.MeshStandardMaterial {
    if (!status) {
      return this.defaultMaterial;
    }

    const material = this.materialCache.get(status);
    return material || this.defaultMaterial;
  }

  /**
   * Apply status-based material to a mesh
   */
  applyMaterialToMesh(mesh: THREE.Mesh, status: StatusType | null | undefined): void {
    const material = this.getMaterialForStatus(status);
    
    // Clone the material to avoid shared references
    const meshMaterial = material.clone();
    
    // Apply the material to the mesh
    if (Array.isArray(mesh.material)) {
      // Replace all materials in array
      mesh.material.forEach(mat => mat.dispose());
      mesh.material = [meshMaterial];
    } else {
      // Dispose old material and apply new one
      if (mesh.material) {
        mesh.material.dispose();
      }
      mesh.material = meshMaterial;
    }
  }

  /**
   * Update material color for a mesh without creating new material
   */
  updateMeshColor(mesh: THREE.Mesh, status: StatusType | null | undefined): void {
    const targetColorHex = this.getColorForStatus(status);
    
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.setHex(targetColorHex);
        }
      });
    } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.color.setHex(targetColorHex);
    } else {
      // If material is not compatible, replace it
      this.applyMaterialToMesh(mesh, status);
    }
  }

  /**
   * Get color value for a status type
   */
  getColorForStatus(status: StatusType | null | undefined): number {
    if (!status) {
      return this.convertColorToHex(DEFAULT_MATERIAL_COLOR);
    }

    const config = MATERIAL_CONFIG[status];
    const color = config?.color || DEFAULT_MATERIAL_COLOR;
    return this.convertColorToHex(color);
  }

  /**
   * Convert color string to hex number for Three.js
   */
  private convertColorToHex(color: string): number {
    // Remove # if present and convert to hex number
    const hexString = color.replace('#', '');
    return parseInt(hexString, 16);
  }

  /**
   * Apply materials to multiple meshes based on panel status map
   */
  applyMaterialsToMeshes(
    meshPanelMappings: Array<{ mesh: THREE.Mesh; panelId: string }>,
    panelStatusMap: Map<string, PanelStatus>
  ): void {
    meshPanelMappings.forEach(({ mesh, panelId }) => {
      const panelStatus = panelStatusMap.get(panelId);
      const status = panelStatus?.status;
      
      this.applyMaterialToMesh(mesh, status);
    });
  }

  /**
   * Update colors for multiple meshes (more efficient than full material replacement)
   */
  updateMeshColors(
    meshPanelMappings: Array<{ mesh: THREE.Mesh; panelId: string }>,
    panelStatusMap: Map<string, PanelStatus>
  ): void {
    meshPanelMappings.forEach(({ mesh, panelId }) => {
      const panelStatus = panelStatusMap.get(panelId);
      const status = panelStatus?.status;
      
      this.updateMeshColor(mesh, status);
    });
  }

  /**
   * Create smooth color transition animation
   */
  animateColorTransition(
    mesh: THREE.Mesh,
    targetStatus: StatusType | null | undefined,
    duration: number = 500
  ): Promise<void> {
    return new Promise((resolve) => {
      const targetColorHex = this.getColorForStatus(targetStatus);
      const targetColor = new THREE.Color(targetColorHex);
      
      if (Array.isArray(mesh.material)) {
        // Handle array of materials
        const materials = mesh.material.filter(mat => mat instanceof THREE.MeshStandardMaterial) as THREE.MeshStandardMaterial[];
        
        if (materials.length === 0) {
          resolve();
          return;
        }

        const startColors = materials.map(mat => mat.color.clone());
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          materials.forEach((material, index) => {
            material.color.lerpColors(startColors[index], targetColor, progress);
          });

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };

        animate();
      } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
        // Handle single material
        const startColor = mesh.material.color.clone();
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          mesh.material.color.lerpColors(startColor, targetColor, progress);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };

        animate();
      } else {
        // Material not compatible, just apply new material
        this.applyMaterialToMesh(mesh, targetStatus);
        resolve();
      }
    });
  }

  /**
   * Dispose of all cached materials to prevent memory leaks
   */
  dispose(): void {
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();
    
    if (this.defaultMaterial) {
      this.defaultMaterial.dispose();
    }
  }

  /**
   * Get all available status types and their colors
   */
  getStatusColorMap(): Map<StatusType, number> {
    const colorMap = new Map<StatusType, number>();
    
    Object.values(StatusType).forEach(status => {
      const config = MATERIAL_CONFIG[status];
      if (config) {
        colorMap.set(status, this.convertColorToHex(config.color));
      }
    });
    
    return colorMap;
  }

  /**
   * Validate that all required status types have material configurations
   */
  validateMaterialConfiguration(): { isValid: boolean; missingStatuses: StatusType[] } {
    const missingStatuses: StatusType[] = [];
    
    Object.values(StatusType).forEach(status => {
      if (!MATERIAL_CONFIG[status]) {
        missingStatuses.push(status);
      }
    });
    
    return {
      isValid: missingStatuses.length === 0,
      missingStatuses
    };
  }
}

// Export singleton instance
export const materialService = new MaterialService();