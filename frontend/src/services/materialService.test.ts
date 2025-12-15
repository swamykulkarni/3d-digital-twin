import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { MaterialService } from './materialService.js';
import { StatusType, PanelStatus } from '../types/index.js';
import { MATERIAL_CONFIG, DEFAULT_MATERIAL_COLOR } from '../constants/materials.js';

describe('MaterialService', () => {
  let materialService: MaterialService;
  let testMesh: THREE.Mesh;

  beforeEach(() => {
    materialService = new MaterialService();
    
    // Create a test mesh with geometry and material
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    testMesh = new THREE.Mesh(geometry, material);
  });

  afterEach(() => {
    // Clean up resources
    materialService.dispose();
    testMesh.geometry.dispose();
    if (testMesh.material instanceof THREE.Material) {
      testMesh.material.dispose();
    }
  });

  describe('getMaterialForStatus', () => {
    it('should return correct material for each status type', () => {
      Object.values(StatusType).forEach(status => {
        const material = materialService.getMaterialForStatus(status);
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        // Convert hex string to number for comparison with getHex()
        const expectedColor = parseInt(MATERIAL_CONFIG[status].color.replace('#', ''), 16);
        expect(material.color.getHex()).toBe(expectedColor);
      });
    });

    it('should return default material for null status', () => {
      const material = materialService.getMaterialForStatus(null);
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      // Convert hex string to number for comparison with getHex()
      const expectedColor = parseInt(DEFAULT_MATERIAL_COLOR.replace('#', ''), 16);
      expect(material.color.getHex()).toBe(expectedColor);
    });

    it('should return default material for undefined status', () => {
      const material = materialService.getMaterialForStatus(undefined);
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      // Convert hex string to number for comparison with getHex()
      const expectedColor = parseInt(DEFAULT_MATERIAL_COLOR.replace('#', ''), 16);
      expect(material.color.getHex()).toBe(expectedColor);
    });
  });

  describe('getColorForStatus', () => {
    it('should return correct color for each status type', () => {
      expect(materialService.getColorForStatus(StatusType.INSTALLED)).toBe(0x00ff00);
      expect(materialService.getColorForStatus(StatusType.PENDING)).toBe(0xffff00);
      expect(materialService.getColorForStatus(StatusType.ISSUE)).toBe(0xff0000);
      expect(materialService.getColorForStatus(StatusType.NOT_STARTED)).toBe(0x808080);
    });

    it('should return default color for null/undefined status', () => {
      expect(materialService.getColorForStatus(null)).toBe(0x808080);
      expect(materialService.getColorForStatus(undefined)).toBe(0x808080);
    });
  });

  describe('applyMaterialToMesh', () => {
    it('should apply correct material for installed status', () => {
      materialService.applyMaterialToMesh(testMesh, StatusType.INSTALLED);
      
      expect(testMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = testMesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it('should apply default material for null status', () => {
      materialService.applyMaterialToMesh(testMesh, null);
      
      expect(testMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = testMesh.material as THREE.MeshStandardMaterial;
      // Convert hex string to number for comparison with getHex()
      const expectedColor = parseInt(DEFAULT_MATERIAL_COLOR.replace('#', ''), 16);
      expect(material.color.getHex()).toBe(expectedColor);
    });

    it('should handle mesh with array of materials', () => {
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      ];
      testMesh.material = materials;

      materialService.applyMaterialToMesh(testMesh, StatusType.PENDING);
      
      expect(Array.isArray(testMesh.material)).toBe(true);
      const meshMaterials = testMesh.material as THREE.Material[];
      expect(meshMaterials.length).toBe(1);
      expect(meshMaterials[0]).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = meshMaterials[0] as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xffff00);
    });
  });

  describe('updateMeshColor', () => {
    it('should update existing material color without replacing material', () => {
      const originalMaterial = testMesh.material as THREE.MeshStandardMaterial;
      
      materialService.updateMeshColor(testMesh, StatusType.ISSUE);
      
      // Should be the same material instance, just with updated color
      expect(testMesh.material).toBe(originalMaterial);
      expect(originalMaterial.color.getHex()).toBe(0xff0000);
    });

    it('should handle array of materials', () => {
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      ];
      testMesh.material = materials;

      materialService.updateMeshColor(testMesh, StatusType.INSTALLED);
      
      materials.forEach(material => {
        expect(material.color.getHex()).toBe(0x00ff00);
      });
    });
  });

  describe('applyMaterialsToMeshes', () => {
    it('should apply materials to multiple meshes based on status map', () => {
      // Create additional test meshes
      const mesh1 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );

      const meshPanelMappings = [
        { mesh: mesh1, panelId: 'PNL-01-001' },
        { mesh: mesh2, panelId: 'PNL-01-002' }
      ];

      const panelStatusMap = new Map<string, PanelStatus>([
        ['PNL-01-001', { id: 'PNL-01-001', status: StatusType.INSTALLED, lastUpdated: new Date() }],
        ['PNL-01-002', { id: 'PNL-01-002', status: StatusType.PENDING, lastUpdated: new Date() }]
      ]);

      materialService.applyMaterialsToMeshes(meshPanelMappings, panelStatusMap);

      const material1 = mesh1.material as THREE.MeshStandardMaterial;
      const material2 = mesh2.material as THREE.MeshStandardMaterial;
      
      expect(material1.color.getHex()).toBe(0x00ff00); // Green for INSTALLED
      expect(material2.color.getHex()).toBe(0xffff00); // Yellow for PENDING

      // Cleanup
      mesh1.geometry.dispose();
      mesh2.geometry.dispose();
      material1.dispose();
      material2.dispose();
    });

    it('should apply default material for panels with no status data', () => {
      const meshPanelMappings = [
        { mesh: testMesh, panelId: 'PNL-01-001' }
      ];

      const panelStatusMap = new Map<string, PanelStatus>(); // Empty map

      materialService.applyMaterialsToMeshes(meshPanelMappings, panelStatusMap);

      const material = testMesh.material as THREE.MeshStandardMaterial;
      // Convert hex string to number for comparison with getHex()
      const expectedColor = parseInt(DEFAULT_MATERIAL_COLOR.replace('#', ''), 16);
      expect(material.color.getHex()).toBe(expectedColor);
    });
  });

  describe('getStatusColorMap', () => {
    it('should return map with all status types and their colors', () => {
      const colorMap = materialService.getStatusColorMap();
      
      expect(colorMap.size).toBe(Object.values(StatusType).length);
      expect(colorMap.get(StatusType.INSTALLED)).toBe(0x00ff00);
      expect(colorMap.get(StatusType.PENDING)).toBe(0xffff00);
      expect(colorMap.get(StatusType.ISSUE)).toBe(0xff0000);
      expect(colorMap.get(StatusType.NOT_STARTED)).toBe(0x808080);
    });
  });

  describe('validateMaterialConfiguration', () => {
    it('should validate that all status types have material configurations', () => {
      const validation = materialService.validateMaterialConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingStatuses).toHaveLength(0);
    });
  });

  describe('animateColorTransition', () => {
    it('should resolve promise after animation completes', async () => {
      const startTime = Date.now();
      
      await materialService.animateColorTransition(testMesh, StatusType.INSTALLED, 100);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least the specified duration
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some tolerance
      
      // Final color should match target status
      const material = testMesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x00ff00);
    });
  });
});