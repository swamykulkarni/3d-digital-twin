import * as THREE from 'three';

// Panel Status Types
export enum StatusType {
  INSTALLED = "INSTALLED",
  PENDING = "PENDING", 
  ISSUE = "ISSUE",
  NOT_STARTED = "NOT_STARTED"
}

export interface PanelStatus {
  id: string;           // Panel ID (e.g., "PNL-05-101")
  status: StatusType;   // INSTALLED | PENDING | ISSUE | NOT_STARTED
  installDate?: Date;   // When panel was installed
  notes?: string;       // Additional status information
  lastUpdated: Date;    // Timestamp of last status change
}

// 3D Model Metadata
export interface ModelMetadata {
  projectId: string;
  gltfUrl: string;
  panelCount: number;
  panelIds: string[];
  uploadDate: Date;
  version: string;
}

// Material Configuration
export interface MaterialConfig {
  [StatusType.INSTALLED]: { color: number };    // Green
  [StatusType.PENDING]: { color: number };      // Yellow  
  [StatusType.ISSUE]: { color: number };        // Red
  [StatusType.NOT_STARTED]: { color: number };  // Gray
}

// Performance Stats Types
export interface PerformanceSummary {
  status: 'good' | 'warning' | 'critical';
  issues: string[];
  metrics: {
    memoryUsage: { totalMB: number };
    renderingStats: { fps: number; frameTime: number };
  } | null;
}

// Component Props Interfaces
export interface StatusPanelProps {
  panelData: PanelStatus[];
  loading: boolean;
  error: string | null;
  selectedProject: string;
  onProjectChange: (project: string) => void;
  onRefresh: () => void;
  selectedPanel: PanelInfo | null;
  onClosePanel: () => void;
  retryInfo?: {
    isRetrying: boolean;
    retryCount: number;
    nextRetryDelay: number;
  };
  performanceStats?: PerformanceSummary | null;
}

export interface PanelInfo {
  id: string;
  status?: StatusType;
  installDate?: Date;
  notes?: string;
  lastUpdated?: Date;
}

// API Response Types
export interface StatusApiResponse {
  panels: PanelStatus[];
}

export interface PanelDetailsResponse {
  id: string;
  status: StatusType;
  installDate?: string;
  notes?: string;
}

// Model Loading Types
export interface MeshPanelMapping {
  mesh: THREE.Mesh;
  panelId: string;
}

export interface ModelLoadResult {
  scene: THREE.Scene;
  meshPanelMappings: MeshPanelMapping[];
  metadata: ModelMetadata;
  warnings: string[];
}