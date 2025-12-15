import * as THREE from 'three';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  memoryUsage: {
    geometries: number;
    textures: number;
    materials: number;
    totalMB: number;
  };
  renderingStats: {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
  };
  sceneStats: {
    objects: number;
    meshes: number;
    lights: number;
    cameras: number;
  };
  timestamp: number;
}

/**
 * Performance thresholds for optimization decisions
 */
export interface PerformanceThresholds {
  maxMemoryMB: number;
  minFPS: number;
  maxFrameTime: number;
  maxDrawCalls: number;
  maxTriangles: number;
}

/**
 * Service for monitoring Three.js performance and memory usage
 */
export class PerformanceMonitorService {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private isMonitoring = false;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 100;
  private monitoringInterval: number | null = null;
  private frameTimeHistory: number[] = [];
  private lastFrameTime = 0;
  
  // Default performance thresholds
  private thresholds: PerformanceThresholds = {
    maxMemoryMB: 512,
    minFPS: 30,
    maxFrameTime: 33, // 30 FPS = 33ms per frame
    maxDrawCalls: 100,
    maxTriangles: 100000
  };

  /**
   * Initialize performance monitoring with renderer and scene
   */
  initialize(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.renderer = renderer;
    this.scene = scene;
    console.log('Performance monitor initialized');
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring || !this.renderer || !this.scene) {
      return;
    }

    this.isMonitoring = true;
    this.frameTimeHistory = [];
    this.lastFrameTime = performance.now();

    // Start periodic metrics collection
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(`Performance monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  collectMetrics(): PerformanceMetrics | null {
    if (!this.renderer || !this.scene) {
      return null;
    }

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Track frame time history for FPS calculation
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) { // Keep last 60 frames
      this.frameTimeHistory.shift();
    }

    const metrics: PerformanceMetrics = {
      memoryUsage: this.getMemoryUsage(),
      renderingStats: this.getRenderingStats(frameTime),
      sceneStats: this.getSceneStats(),
      timestamp: currentTime
    };

    // Store metrics in history
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Check for performance issues
    this.checkPerformanceThresholds(metrics);

    return metrics;
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if (!this.renderer) {
      return { geometries: 0, textures: 0, materials: 0, totalMB: 0 };
    }

    const info = this.renderer.info;
    const memory = info.memory;

    // Estimate memory usage (approximate calculations)
    const geometryMemory = memory.geometries * 0.1; // ~100KB per geometry estimate
    const textureMemory = memory.textures * 2; // ~2MB per texture estimate  
    const materialMemory = this.scene ? this.countMaterials() * 0.01 : 0; // ~10KB per material

    const totalMB = geometryMemory + textureMemory + materialMemory;

    return {
      geometries: memory.geometries,
      textures: memory.textures,
      materials: this.scene ? this.countMaterials() : 0,
      totalMB: Math.round(totalMB * 100) / 100
    };
  }

  /**
   * Get rendering performance statistics
   */
  private getRenderingStats(currentFrameTime: number): PerformanceMetrics['renderingStats'] {
    if (!this.renderer) {
      return { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 };
    }

    const info = this.renderer.info;
    
    // Calculate FPS from frame time history
    const avgFrameTime = this.frameTimeHistory.length > 0 
      ? this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
      : currentFrameTime;
    
    const fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;

    return {
      fps,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      drawCalls: info.render.calls,
      triangles: info.render.triangles
    };
  }

  /**
   * Get scene statistics
   */
  private getSceneStats(): PerformanceMetrics['sceneStats'] {
    if (!this.scene) {
      return { objects: 0, meshes: 0, lights: 0, cameras: 0 };
    }

    let objects = 0;
    let meshes = 0;
    let lights = 0;
    let cameras = 0;

    this.scene.traverse((object) => {
      objects++;
      if (object instanceof THREE.Mesh) {
        meshes++;
      } else if (object instanceof THREE.Light) {
        lights++;
      } else if (object instanceof THREE.Camera) {
        cameras++;
      }
    });

    return { objects, meshes, lights, cameras };
  }

  /**
   * Count materials in the scene
   */
  private countMaterials(): number {
    if (!this.scene) return 0;

    const materials = new Set<THREE.Material>();
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => materials.add(mat));
        } else {
          materials.add(object.material);
        }
      }
    });

    return materials.size;
  }

  /**
   * Check if current metrics exceed performance thresholds
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const issues: string[] = [];

    if (metrics.memoryUsage.totalMB > this.thresholds.maxMemoryMB) {
      issues.push(`High memory usage: ${metrics.memoryUsage.totalMB}MB (threshold: ${this.thresholds.maxMemoryMB}MB)`);
    }

    if (metrics.renderingStats.fps < this.thresholds.minFPS) {
      issues.push(`Low FPS: ${metrics.renderingStats.fps} (threshold: ${this.thresholds.minFPS})`);
    }

    if (metrics.renderingStats.frameTime > this.thresholds.maxFrameTime) {
      issues.push(`High frame time: ${metrics.renderingStats.frameTime}ms (threshold: ${this.thresholds.maxFrameTime}ms)`);
    }

    if (metrics.renderingStats.drawCalls > this.thresholds.maxDrawCalls) {
      issues.push(`High draw calls: ${metrics.renderingStats.drawCalls} (threshold: ${this.thresholds.maxDrawCalls})`);
    }

    if (metrics.renderingStats.triangles > this.thresholds.maxTriangles) {
      issues.push(`High triangle count: ${metrics.renderingStats.triangles} (threshold: ${this.thresholds.maxTriangles})`);
    }

    if (issues.length > 0) {
      console.warn('Performance issues detected:', issues);
      this.onPerformanceIssues?.(issues, metrics);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get average metrics over a time period
   */
  getAverageMetrics(periodMs: number = 10000): Partial<PerformanceMetrics> | null {
    const cutoffTime = performance.now() - periodMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return null;
    }

    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.totalMB, 0) / recentMetrics.length;
    const avgFPS = recentMetrics.reduce((sum, m) => sum + m.renderingStats.fps, 0) / recentMetrics.length;
    const avgFrameTime = recentMetrics.reduce((sum, m) => sum + m.renderingStats.frameTime, 0) / recentMetrics.length;

    return {
      memoryUsage: { totalMB: Math.round(avgMemory * 100) / 100 } as any,
      renderingStats: { 
        fps: Math.round(avgFPS), 
        frameTime: Math.round(avgFrameTime * 100) / 100 
      } as any
    };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Performance thresholds updated:', this.thresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Check if performance is currently acceptable
   */
  isPerformanceAcceptable(): boolean {
    const current = this.getCurrentMetrics();
    if (!current) return true;

    return (
      current.memoryUsage.totalMB <= this.thresholds.maxMemoryMB &&
      current.renderingStats.fps >= this.thresholds.minFPS &&
      current.renderingStats.frameTime <= this.thresholds.maxFrameTime &&
      current.renderingStats.drawCalls <= this.thresholds.maxDrawCalls &&
      current.renderingStats.triangles <= this.thresholds.maxTriangles
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    status: 'good' | 'warning' | 'critical';
    issues: string[];
    metrics: PerformanceMetrics | null;
  } {
    const current = this.getCurrentMetrics();
    const issues: string[] = [];
    let status: 'good' | 'warning' | 'critical' = 'good';

    if (!current) {
      return { status: 'good', issues: [], metrics: null };
    }

    // Check each threshold
    if (current.memoryUsage.totalMB > this.thresholds.maxMemoryMB * 0.8) {
      issues.push(`Memory usage: ${current.memoryUsage.totalMB}MB`);
      status = current.memoryUsage.totalMB > this.thresholds.maxMemoryMB ? 'critical' : 'warning';
    }

    if (current.renderingStats.fps < this.thresholds.minFPS * 1.2) {
      issues.push(`FPS: ${current.renderingStats.fps}`);
      status = current.renderingStats.fps < this.thresholds.minFPS ? 'critical' : 'warning';
    }

    return { status, issues, metrics: current };
  }

  /**
   * Reset metrics history
   */
  reset(): void {
    this.metrics = [];
    this.frameTimeHistory = [];
    this.lastFrameTime = performance.now();
  }

  /**
   * Callback for performance issues (can be set by consumers)
   */
  onPerformanceIssues?: (issues: string[], metrics: PerformanceMetrics) => void;

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopMonitoring();
    this.reset();
    this.renderer = null;
    this.scene = null;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitorService();