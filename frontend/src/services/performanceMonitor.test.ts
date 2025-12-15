import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performanceMonitor } from './performanceMonitor.js';
import * as THREE from 'three';

// Mock Three.js WebGLRenderer
const mockRenderer = {
  info: {
    memory: {
      geometries: 5,
      textures: 3
    },
    render: {
      calls: 25,
      triangles: 5000
    }
  }
} as THREE.WebGLRenderer;

// Mock Three.js Scene
const mockScene = new THREE.Scene();

describe('PerformanceMonitorService', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('Initialization', () => {
    it('should initialize with renderer and scene', () => {
      performanceMonitor.initialize(mockRenderer, mockScene);
      
      const metrics = performanceMonitor.collectMetrics();
      expect(metrics).toBeTruthy();
      expect(metrics?.memoryUsage.geometries).toBe(5);
      expect(metrics?.memoryUsage.textures).toBe(3);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      performanceMonitor.initialize(mockRenderer, mockScene);
    });

    it('should collect performance metrics', () => {
      const metrics = performanceMonitor.collectMetrics();
      
      expect(metrics).toBeTruthy();
      expect(metrics?.memoryUsage).toBeDefined();
      expect(metrics?.renderingStats).toBeDefined();
      expect(metrics?.sceneStats).toBeDefined();
      expect(metrics?.timestamp).toBeTypeOf('number');
    });

    it('should track memory usage', () => {
      const metrics = performanceMonitor.collectMetrics();
      
      expect(metrics?.memoryUsage.geometries).toBe(5);
      expect(metrics?.memoryUsage.textures).toBe(3);
      expect(metrics?.memoryUsage.totalMB).toBeTypeOf('number');
    });

    it('should track rendering statistics', () => {
      const metrics = performanceMonitor.collectMetrics();
      
      expect(metrics?.renderingStats.drawCalls).toBe(25);
      expect(metrics?.renderingStats.triangles).toBe(5000);
      expect(metrics?.renderingStats.fps).toBeTypeOf('number');
      expect(metrics?.renderingStats.frameTime).toBeTypeOf('number');
    });
  });

  describe('Performance Thresholds', () => {
    beforeEach(() => {
      performanceMonitor.initialize(mockRenderer, mockScene);
    });

    it('should update performance thresholds', () => {
      const newThresholds = {
        maxMemoryMB: 1024,
        minFPS: 60
      };
      
      performanceMonitor.updateThresholds(newThresholds);
      const thresholds = performanceMonitor.getThresholds();
      
      expect(thresholds.maxMemoryMB).toBe(1024);
      expect(thresholds.minFPS).toBe(60);
    });

    it('should detect performance issues', () => {
      let issuesDetected = false;
      let detectedIssues: string[] = [];
      
      performanceMonitor.onPerformanceIssues = (issues) => {
        issuesDetected = true;
        detectedIssues = issues;
      };
      
      // Set very low thresholds to trigger issues
      performanceMonitor.updateThresholds({
        maxMemoryMB: 0.1,
        minFPS: 120,
        maxDrawCalls: 1
      });
      
      performanceMonitor.collectMetrics();
      
      expect(issuesDetected).toBe(true);
      expect(detectedIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Monitoring Control', () => {
    beforeEach(() => {
      performanceMonitor.initialize(mockRenderer, mockScene);
    });

    it('should start and stop monitoring', () => {
      // Collect initial metrics first
      performanceMonitor.collectMetrics();
      
      performanceMonitor.startMonitoring(100);
      expect(performanceMonitor.getCurrentMetrics()).toBeTruthy();
      
      performanceMonitor.stopMonitoring();
      // Should still have the last collected metrics
      expect(performanceMonitor.getCurrentMetrics()).toBeTruthy();
    });

    it('should maintain metrics history', () => {
      performanceMonitor.collectMetrics();
      performanceMonitor.collectMetrics();
      
      const history = performanceMonitor.getMetricsHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('Performance Summary', () => {
    beforeEach(() => {
      performanceMonitor.initialize(mockRenderer, mockScene);
    });

    it('should provide performance summary', () => {
      performanceMonitor.collectMetrics();
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.status).toMatch(/good|warning|critical/);
      expect(summary.issues).toBeInstanceOf(Array);
      expect(summary.metrics).toBeTruthy();
    });

    it('should indicate good performance with default thresholds', () => {
      // Reset thresholds to defaults first
      performanceMonitor.updateThresholds({
        maxMemoryMB: 512,
        minFPS: 30,
        maxFrameTime: 33,
        maxDrawCalls: 100,
        maxTriangles: 100000
      });
      
      performanceMonitor.collectMetrics();
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.status).toBe('good');
    });
  });
});