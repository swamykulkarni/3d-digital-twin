import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { StatusUpdateService } from './statusUpdateService.js';
import { PanelStatus, StatusType } from '../types/index.js';
import { materialService } from './materialService.js';

// Mock the material service
vi.mock('./materialService.js', () => ({
  materialService: {
    updateMeshColor: vi.fn(),
    animateColorTransition: vi.fn().mockResolvedValue(undefined),
    applyMaterialsToMeshes: vi.fn(),
    updateMeshColors: vi.fn()
  }
}));

describe('StatusUpdateService', () => {
  let service: StatusUpdateService;
  let mockMeshes: THREE.Mesh[];
  let mockMappings: Array<{ mesh: THREE.Mesh; panelId: string }>;

  beforeEach(() => {
    service = new StatusUpdateService();
    
    // Create mock meshes
    mockMeshes = [
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
    ];

    mockMappings = [
      { mesh: mockMeshes[0], panelId: 'PNL-01-001' },
      { mesh: mockMeshes[1], panelId: 'PNL-01-002' },
      { mesh: mockMeshes[2], panelId: 'PNL-01-003' }
    ];

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.reset();
  });

  describe('setMeshPanelMappings', () => {
    it('should store mesh panel mappings', () => {
      service.setMeshPanelMappings(mockMappings);
      
      const stats = service.getUpdateStats();
      expect(stats.totalMeshes).toBe(3);
    });
  });

  describe('detectChanges', () => {
    it('should detect no changes when status data is identical', () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      // First update to establish baseline
      service.updatePanelStatuses(initialData);
      
      // Second update with same data
      const changes = service.detectChanges(initialData);
      expect(changes).toHaveLength(0);
    });

    it('should detect status changes', async () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData);
      
      // Detect changes
      const changes = service.detectChanges(updatedData);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].panelId).toBe('PNL-01-001');
      expect(changes[0].oldStatus).toBe(StatusType.PENDING);
      expect(changes[0].newStatus).toBe(StatusType.INSTALLED);
      expect(changes[0].mesh).toBe(mockMeshes[0]);
    });

    it('should detect new panels', async () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData);
      
      // Detect changes
      const changes = service.detectChanges(updatedData);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].panelId).toBe('PNL-01-002');
      expect(changes[0].oldStatus).toBeUndefined();
      expect(changes[0].newStatus).toBe(StatusType.INSTALLED);
    });

    it('should detect removed panels', async () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData);
      
      // Detect changes
      const changes = service.detectChanges(updatedData);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].panelId).toBe('PNL-01-002');
      expect(changes[0].oldStatus).toBe(StatusType.INSTALLED);
      expect(changes[0].newStatus).toBeNull();
    });
  });

  describe('updatePanelStatuses', () => {
    it('should skip update when no changes detected', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // First update
      await service.updatePanelStatuses(panelData);
      
      // Second update with same data
      await service.updatePanelStatuses(panelData);
      
      // Should only call material service once (for first update)
      expect(materialService.animateColorTransition).toHaveBeenCalledTimes(1);
    });

    it('should apply animated updates when enabled', async () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData, { enableAnimations: false });
      
      // Apply update with animations
      await service.updatePanelStatuses(updatedData, { 
        enableAnimations: true,
        animationDuration: 300
      });
      
      expect(materialService.animateColorTransition).toHaveBeenCalledWith(
        mockMeshes[0],
        StatusType.INSTALLED,
        300
      );
    });

    it('should apply instant updates when animations disabled', async () => {
      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData, { enableAnimations: false });
      
      // Apply update without animations
      await service.updatePanelStatuses(updatedData, { enableAnimations: false });
      
      expect(materialService.updateMeshColor).toHaveBeenCalledWith(
        mockMeshes[0],
        StatusType.INSTALLED
      );
    });

    it('should handle animation failures gracefully', async () => {
      const mockError = new Error('Animation failed');
      (materialService.animateColorTransition as any).mockRejectedValueOnce(mockError);

      const initialData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      const updatedData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Establish baseline
      await service.updatePanelStatuses(initialData, { enableAnimations: false });
      
      // Apply update with failing animation
      await service.updatePanelStatuses(updatedData, { enableAnimations: true });
      
      // Should fallback to instant update
      expect(materialService.updateMeshColor).toHaveBeenCalledWith(
        mockMeshes[0],
        StatusType.INSTALLED
      );
    });

    it('should prevent concurrent updates', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      // Start two updates simultaneously
      const promise1 = service.updatePanelStatuses(panelData);
      const promise2 = service.updatePanelStatuses(panelData);
      
      await Promise.all([promise1, promise2]);
      
      // Second update should be skipped
      expect(materialService.animateColorTransition).toHaveBeenCalledTimes(1);
    });
  });

  describe('forceUpdateAll', () => {
    it('should update all meshes without animations by default', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() },
        { id: 'PNL-01-002', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      await service.forceUpdateAll(panelData);
      
      expect(materialService.updateMeshColors).toHaveBeenCalledWith(
        mockMappings,
        expect.any(Map)
      );
    });

    it('should update all meshes with animations when enabled', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }
      ];

      service.setMeshPanelMappings(mockMappings);
      
      await service.forceUpdateAll(panelData, { enableAnimations: true });
      
      expect(materialService.animateColorTransition).toHaveBeenCalledTimes(3); // All 3 meshes
    });
  });

  describe('utility methods', () => {
    it('should return correct update stats', () => {
      service.setMeshPanelMappings(mockMappings);
      
      const stats = service.getUpdateStats();
      expect(stats.totalMeshes).toBe(3);
      expect(stats.trackedPanels).toBe(0);
      expect(stats.updateInProgress).toBe(false);
    });

    it('should reset all data', () => {
      service.setMeshPanelMappings(mockMappings);
      
      service.reset();
      
      const stats = service.getUpdateStats();
      expect(stats.totalMeshes).toBe(0);
      expect(stats.trackedPanels).toBe(0);
    });

    it('should check if status has changed', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      await service.updatePanelStatuses(panelData);
      
      expect(service.hasStatusChanged('PNL-01-001', StatusType.PENDING)).toBe(false);
      expect(service.hasStatusChanged('PNL-01-001', StatusType.INSTALLED)).toBe(true);
      expect(service.hasStatusChanged('PNL-01-999', StatusType.INSTALLED)).toBe(true);
    });

    it('should get current status for panel', async () => {
      const panelData: PanelStatus[] = [
        { id: 'PNL-01-001', status: StatusType.PENDING, lastUpdated: new Date() }
      ];

      await service.updatePanelStatuses(panelData);
      
      const status = service.getCurrentStatus('PNL-01-001');
      expect(status?.status).toBe(StatusType.PENDING);
      
      const nonExistent = service.getCurrentStatus('PNL-01-999');
      expect(nonExistent).toBeNull();
    });
  });
});