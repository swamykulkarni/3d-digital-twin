import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ModelLoaderService } from './modelLoader.js';

// Mock Three.js GLTFLoader
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class MockGLTFLoader {
    load = vi.fn();
  }
}));

describe('ModelLoaderService', () => {
  let service: ModelLoaderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ModelLoaderService();
  });

  describe('loadModel', () => {
    it('should load GLTF model and extract panel mappings', async () => {
      // Create mock mesh with valid panel ID
      const mockMesh = new THREE.Mesh();
      mockMesh.name = 'Panel_PNL-05-101_Geometry';
      
      const mockScene = new THREE.Scene();
      mockScene.add(mockMesh);
      
      const mockGltf = { scene: mockScene };

      // Mock the loader.load method
      const mockLoader = (service as any).loader;
      mockLoader.load.mockImplementation((url: string, onLoad: Function) => {
        onLoad(mockGltf);
      });

      const result = await service.loadModel('https://example.com/test.gltf', 'project1');

      expect(result.scene).toBe(mockScene);
      expect(result.meshPanelMappings).toHaveLength(1);
      expect(result.meshPanelMappings[0].panelId).toBe('PNL-05-101');
      expect(result.meshPanelMappings[0].mesh).toBe(mockMesh);
      expect(result.metadata.projectId).toBe('project1');
      expect(result.metadata.panelCount).toBe(1);
      expect(result.metadata.panelIds).toEqual(['PNL-05-101']);
    });

    it('should handle meshes without valid panel IDs', async () => {
      // Create mock meshes - one valid, one invalid
      const validMesh = new THREE.Mesh();
      validMesh.name = 'Panel_PNL-05-101_Geometry';
      
      const invalidMesh = new THREE.Mesh();
      invalidMesh.name = 'SomeOtherMesh';
      
      const mockScene = new THREE.Scene();
      mockScene.add(validMesh);
      mockScene.add(invalidMesh);
      
      const mockGltf = { scene: mockScene };

      const mockLoader = (service as any).loader;
      mockLoader.load.mockImplementation((url: string, onLoad: Function) => {
        onLoad(mockGltf);
      });

      const result = await service.loadModel('https://example.com/test.gltf', 'project1');

      expect(result.meshPanelMappings).toHaveLength(1);
      expect(result.meshPanelMappings[0].panelId).toBe('PNL-05-101');
      expect(result.warnings).toContain('Mesh "SomeOtherMesh" does not contain valid Panel ID format - will use default material');
    });

    it('should handle duplicate panel IDs', async () => {
      // Create multiple meshes with same panel ID
      const mesh1 = new THREE.Mesh();
      mesh1.name = 'Panel_PNL-05-101_Part1';
      
      const mesh2 = new THREE.Mesh();
      mesh2.name = 'Panel_PNL-05-101_Part2';
      
      const mockScene = new THREE.Scene();
      mockScene.add(mesh1);
      mockScene.add(mesh2);
      
      const mockGltf = { scene: mockScene };

      const mockLoader = (service as any).loader;
      mockLoader.load.mockImplementation((url: string, onLoad: Function) => {
        onLoad(mockGltf);
      });

      const result = await service.loadModel('https://example.com/test.gltf', 'project1');

      expect(result.meshPanelMappings).toHaveLength(2);
      expect(result.metadata.panelCount).toBe(1); // Unique panel count
      expect(result.metadata.panelIds).toEqual(['PNL-05-101']);
    });

    it('should throw error when GLTF loading fails', async () => {
      const mockLoader = (service as any).loader;
      mockLoader.load.mockImplementation((url: string, onLoad: Function, onProgress: Function, onError: Function) => {
        onError(new Error('Network error'));
      });

      await expect(service.loadModel('https://example.com/invalid.gltf', 'project1')).rejects.toThrow('Failed to load GLTF model');
    });
  });

  describe('validateModel', () => {
    it('should validate model with valid structure', () => {
      const mockMesh = new THREE.Mesh();
      mockMesh.name = 'Panel_PNL-05-101_Geometry';
      
      const mockScene = new THREE.Scene();
      mockScene.add(mockMesh);
      
      const mockGltf = { scene: mockScene };

      const result = service.validateModel(mockGltf);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject model without scene', () => {
      const result = service.validateModel({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid GLTF structure - missing scene');
    });

    it('should reject model without meshes', () => {
      const mockScene = new THREE.Scene();
      const mockGltf = { scene: mockScene };

      const result = service.validateModel(mockGltf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No meshes found in GLTF model');
    });

    it('should reject model without valid panel meshes', () => {
      const mockMesh = new THREE.Mesh();
      mockMesh.name = 'InvalidMeshName';
      
      const mockScene = new THREE.Scene();
      mockScene.add(mockMesh);
      
      const mockGltf = { scene: mockScene };

      const result = service.validateModel(mockGltf);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No valid panel meshes found - check mesh naming conventions (expected format: PNL-XX-XXX)');
    });
  });

  describe('createPanelIdToMeshesMap', () => {
    it('should create correct mapping for unique panel IDs', () => {
      const mesh1 = new THREE.Mesh();
      const mesh2 = new THREE.Mesh();
      
      const mappings = [
        { mesh: mesh1, panelId: 'PNL-05-101' },
        { mesh: mesh2, panelId: 'PNL-05-102' }
      ];

      const result = service.createPanelIdToMeshesMap(mappings);

      expect(result.size).toBe(2);
      expect(result.get('PNL-05-101')).toEqual([mesh1]);
      expect(result.get('PNL-05-102')).toEqual([mesh2]);
    });

    it('should handle duplicate panel IDs correctly', () => {
      const mesh1 = new THREE.Mesh();
      const mesh2 = new THREE.Mesh();
      
      const mappings = [
        { mesh: mesh1, panelId: 'PNL-05-101' },
        { mesh: mesh2, panelId: 'PNL-05-101' }
      ];

      const result = service.createPanelIdToMeshesMap(mappings);

      expect(result.size).toBe(1);
      expect(result.get('PNL-05-101')).toEqual([mesh1, mesh2]);
    });
  });

  describe('getUniquePanelIds', () => {
    it('should return sorted unique panel IDs', () => {
      const mappings = [
        { mesh: new THREE.Mesh(), panelId: 'PNL-05-102' },
        { mesh: new THREE.Mesh(), panelId: 'PNL-05-101' },
        { mesh: new THREE.Mesh(), panelId: 'PNL-05-102' } // Duplicate
      ];

      const result = service.getUniquePanelIds(mappings);

      expect(result).toEqual(['PNL-05-101', 'PNL-05-102']);
    });
  });
});