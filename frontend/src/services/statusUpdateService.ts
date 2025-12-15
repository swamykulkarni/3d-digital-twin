import * as THREE from 'three';
import { PanelStatus, StatusType } from '../types/index.js';
import { materialService } from './materialService.js';

export interface StatusChange {
  panelId: string;
  oldStatus: StatusType | null | undefined;
  newStatus: StatusType | null | undefined;
  mesh?: THREE.Mesh;
}

export interface UpdateOptions {
  animationDuration?: number;
  batchSize?: number;
  enableAnimations?: boolean;
}

/**
 * Service for efficiently updating panel status with change detection and smooth transitions
 */
export class StatusUpdateService {
  private previousStatusMap: Map<string, PanelStatus> = new Map();
  private meshPanelMappings: Array<{ mesh: THREE.Mesh; panelId: string }> = [];
  private updateInProgress = false;

  /**
   * Set the mesh-panel mappings for efficient updates
   */
  setMeshPanelMappings(mappings: Array<{ mesh: THREE.Mesh; panelId: string }>): void {
    this.meshPanelMappings = mappings;
  }

  /**
   * Detect changes between current and new status data
   */
  detectChanges(newPanelData: PanelStatus[]): StatusChange[] {
    const changes: StatusChange[] = [];
    const newStatusMap = new Map<string, PanelStatus>();

    // Build new status map
    newPanelData.forEach(panel => {
      newStatusMap.set(panel.id, panel);
    });

    // Check for changes in existing panels
    for (const [panelId, newPanel] of newStatusMap) {
      const oldPanel = this.previousStatusMap.get(panelId);
      const oldStatus = oldPanel?.status;
      const newStatus = newPanel.status;

      if (oldStatus !== newStatus) {
        // Find the mesh for this panel
        const mapping = this.meshPanelMappings.find(m => m.panelId === panelId);
        
        changes.push({
          panelId,
          oldStatus,
          newStatus,
          mesh: mapping?.mesh
        });
      }
    }

    // Check for panels that were removed (now have no status)
    for (const [panelId, oldPanel] of this.previousStatusMap) {
      if (!newStatusMap.has(panelId)) {
        const mapping = this.meshPanelMappings.find(m => m.panelId === panelId);
        
        changes.push({
          panelId,
          oldStatus: oldPanel.status,
          newStatus: null,
          mesh: mapping?.mesh
        });
      }
    }

    return changes;
  }

  /**
   * Apply status updates efficiently with change detection and animations
   */
  async updatePanelStatuses(
    newPanelData: PanelStatus[],
    options: UpdateOptions = {}
  ): Promise<void> {
    if (this.updateInProgress) {
      console.warn('Status update already in progress, skipping...');
      return;
    }

    this.updateInProgress = true;

    try {
      const {
        animationDuration = 500,
        batchSize = 10,
        enableAnimations = true
      } = options;

      // Detect what has changed
      const changes = this.detectChanges(newPanelData);

      if (changes.length === 0) {
        console.log('No status changes detected, skipping update');
        this.updatePreviousStatusMap(newPanelData);
        return;
      }

      console.log(`Detected ${changes.length} status changes, applying updates...`);

      // Filter changes that have associated meshes
      const meshChanges = changes.filter(change => change.mesh);
      const unmappedChanges = changes.filter(change => !change.mesh);

      if (unmappedChanges.length > 0) {
        console.warn(`${unmappedChanges.length} status changes have no associated mesh:`, 
          unmappedChanges.map(c => c.panelId));
      }

      if (meshChanges.length === 0) {
        console.log('No mesh changes to apply');
        this.updatePreviousStatusMap(newPanelData);
        return;
      }

      // Apply updates in batches to avoid blocking the main thread
      if (enableAnimations) {
        await this.applyAnimatedUpdates(meshChanges, animationDuration, batchSize);
      } else {
        await this.applyInstantUpdates(meshChanges, batchSize);
      }

      // Update the previous status map for next comparison
      this.updatePreviousStatusMap(newPanelData);

      console.log(`Successfully updated ${meshChanges.length} panel statuses`);
    } catch (error) {
      console.error('Error during status update:', error);
      throw error;
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Apply updates with smooth color transitions
   */
  private async applyAnimatedUpdates(
    changes: StatusChange[],
    animationDuration: number,
    batchSize: number
  ): Promise<void> {
    // Process changes in batches to avoid overwhelming the browser
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      
      // Start all animations in the batch simultaneously
      const animationPromises = batch.map(change => {
        if (!change.mesh) return Promise.resolve();
        
        return materialService.animateColorTransition(
          change.mesh,
          change.newStatus,
          animationDuration
        ).catch(error => {
          console.error(`Animation failed for panel ${change.panelId}:`, error);
          // Fallback to instant update
          materialService.updateMeshColor(change.mesh!, change.newStatus);
        });
      });

      // Wait for all animations in the batch to complete
      await Promise.all(animationPromises);

      // Small delay between batches to prevent frame drops
      if (i + batchSize < changes.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Apply updates instantly without animations
   */
  private async applyInstantUpdates(
    changes: StatusChange[],
    batchSize: number
  ): Promise<void> {
    // Process changes in batches
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      
      batch.forEach(change => {
        if (change.mesh) {
          materialService.updateMeshColor(change.mesh, change.newStatus);
        }
      });

      // Small delay between batches to prevent blocking
      if (i + batchSize < changes.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Update the internal status map for change detection
   */
  private updatePreviousStatusMap(newPanelData: PanelStatus[]): void {
    this.previousStatusMap.clear();
    newPanelData.forEach(panel => {
      this.previousStatusMap.set(panel.id, { ...panel });
    });
  }

  /**
   * Force update all panels (useful for initial load or full refresh)
   */
  async forceUpdateAll(
    panelData: PanelStatus[],
    options: UpdateOptions = {}
  ): Promise<void> {
    if (this.meshPanelMappings.length === 0) {
      console.warn('No mesh mappings available for force update');
      return;
    }

    const {
      animationDuration = 500,
      batchSize = 10,
      enableAnimations = false // Usually don't animate full updates
    } = options;

    console.log(`Force updating all ${this.meshPanelMappings.length} panel meshes`);

    // Create panel status map for efficient lookups
    const panelStatusMap = new Map<string, PanelStatus>();
    panelData.forEach(panel => {
      panelStatusMap.set(panel.id, panel);
    });

    // Apply updates to all meshes
    if (enableAnimations) {
      // Create changes for all meshes
      const allChanges: StatusChange[] = this.meshPanelMappings.map(mapping => ({
        panelId: mapping.panelId,
        oldStatus: null,
        newStatus: panelStatusMap.get(mapping.panelId)?.status,
        mesh: mapping.mesh
      }));

      await this.applyAnimatedUpdates(allChanges, animationDuration, batchSize);
    } else {
      // Use the material service's batch update method
      materialService.updateMeshColors(this.meshPanelMappings, panelStatusMap);
    }

    // Update the previous status map
    this.updatePreviousStatusMap(panelData);
  }

  /**
   * Get statistics about the current state
   */
  getUpdateStats() {
    return {
      totalMeshes: this.meshPanelMappings.length,
      trackedPanels: this.previousStatusMap.size,
      updateInProgress: this.updateInProgress
    };
  }

  /**
   * Clear all cached data (useful for cleanup or project changes)
   */
  reset(): void {
    this.previousStatusMap.clear();
    this.meshPanelMappings = [];
    this.updateInProgress = false;
  }

  /**
   * Get the current status for a specific panel
   */
  getCurrentStatus(panelId: string): PanelStatus | null {
    return this.previousStatusMap.get(panelId) || null;
  }

  /**
   * Check if a panel status has changed since last update
   */
  hasStatusChanged(panelId: string, newStatus: StatusType | null | undefined): boolean {
    const currentPanel = this.previousStatusMap.get(panelId);
    return currentPanel?.status !== newStatus;
  }
}

// Export singleton instance
export const statusUpdateService = new StatusUpdateService();