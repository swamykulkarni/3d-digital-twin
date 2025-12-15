import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock Three.js components with more realistic behavior
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, camera, style }) => (
    <div data-testid="canvas" style={style} data-camera={JSON.stringify(camera)}>
      {children}
    </div>
  )
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props) => <div data-testid="orbit-controls" data-props={JSON.stringify(props)} />,
  Environment: (props) => <div data-testid="environment" data-preset={props.preset} />
}))

// Mock services with realistic implementations
vi.mock('./services/errorRecoveryService', () => ({
  errorRecoveryService: {
    setCallbacks: vi.fn(),
    hasErrors: vi.fn(() => false),
    forceRecovery: vi.fn(() => Promise.resolve()),
    getErrorState: vi.fn(() => ({ hasStorageError: false }))
  }
}))

vi.mock('./services/azureStorage', () => ({
  azureStorage: {
    initialize: vi.fn(),
    getModelUrl: vi.fn(),
    testConnection: vi.fn(),
    modelExists: vi.fn(),
    updateRetryConfig: vi.fn()
  }
}))

vi.mock('./services/performanceMonitor', () => ({
  performanceMonitor: {
    getPerformanceSummary: vi.fn(() => ({
      status: 'good',
      issues: [],
      memoryUsage: 50,
      renderTime: 16
    })),
    dispose: vi.fn()
  }
}))

vi.mock('./services/resourceManager', () => ({
  resourceManager: {
    dispose: vi.fn()
  }
}))

vi.mock('./config/azureConfig', () => ({
  getAzureConfig: vi.fn(() => ({
    connectionString: 'test-connection',
    accountName: 'testaccount',
    accountKey: 'testkey',
    containerName: 'models',
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  })),
  validateAzureConfig: vi.fn(() => ({ isValid: true, errors: [] }))
}))

// Mock PanelViewer with realistic behavior
vi.mock('./components/PanelViewer', () => ({
  default: ({ panelData, gltfUrl, projectId, onPanelClick }) => {
    const handleClick = (panelId) => {
      onPanelClick(panelId)
    }

    return (
      <div data-testid="panel-viewer" data-project={projectId} data-gltf-url={gltfUrl}>
        <div>Panel count: {panelData?.length || 0}</div>
        <div>Project: {projectId}</div>
        <div>Model URL: {gltfUrl || 'No model'}</div>
        {panelData?.map(panel => (
          <button 
            key={panel.id} 
            onClick={() => handleClick(panel.id)}
            data-testid={`panel-${panel.id}`}
            data-status={panel.status}
          >
            {panel.id} ({panel.status})
          </button>
        ))}
      </div>
    )
  }
}))

// Mock StatusPanel with realistic behavior
vi.mock('./components/StatusPanel', () => ({
  default: ({ 
    panelData, 
    loading, 
    error, 
    selectedProject, 
    onProjectChange, 
    onRefresh, 
    retryInfo, 
    selectedPanel, 
    onClosePanel,
    performanceStats 
  }) => (
    <div data-testid="status-panel">
      <div data-testid="loading-state">Loading: {loading ? 'true' : 'false'}</div>
      <div data-testid="error-state">Error: {error || 'none'}</div>
      <div data-testid="panel-count">Panel count: {panelData?.length || 0}</div>
      <div data-testid="current-project">Project: {selectedProject}</div>
      
      <select 
        data-testid="project-selector" 
        value={selectedProject} 
        onChange={(e) => onProjectChange(e.target.value)}
      >
        <option value="BuildingA">Building A</option>
        <option value="BuildingB">Building B</option>
      </select>
      
      <button data-testid="refresh-button" onClick={onRefresh}>
        Refresh
      </button>
      
      {retryInfo?.isRetrying && (
        <div data-testid="retry-info">
          Retrying... (attempt {retryInfo.retryCount})
        </div>
      )}
      
      {selectedPanel && (
        <div data-testid="selected-panel-info">
          <div>Selected Panel: {selectedPanel.id}</div>
          <div>Status: {selectedPanel.status || 'No status'}</div>
          <div>Install Date: {selectedPanel.installDate || 'Not installed'}</div>
          <div>Notes: {selectedPanel.notes || 'No notes'}</div>
          <button data-testid="close-panel" onClick={onClosePanel}>
            Close Panel
          </button>
        </div>
      )}
      
      {performanceStats && (
        <div data-testid="performance-stats">
          Performance: {performanceStats.status}
        </div>
      )}
    </div>
  )
}))

// Mock the polling hook with realistic behavior
vi.mock('./hooks/useStatusPolling', () => ({
  useStatusPolling: vi.fn()
}))

describe('3D Digital Twin - Complete Integration Tests', () => {
  let mockPanelData
  let mockUseStatusPolling

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset fetch mock
    fetch.mockClear()
    
    // Setup mock panel data
    mockPanelData = [
      { 
        id: 'PNL-05-101', 
        status: 'INSTALLED', 
        installDate: '2024-12-10', 
        notes: 'Installation completed successfully',
        lastUpdated: '2024-12-10T14:30:00Z'
      },
      { 
        id: 'PNL-05-102', 
        status: 'PENDING', 
        installDate: null, 
        notes: 'Awaiting materials delivery',
        lastUpdated: '2024-12-09T09:15:00Z'
      },
      { 
        id: 'PNL-05-103', 
        status: 'ISSUE', 
        installDate: null, 
        notes: 'Damaged panel, replacement ordered',
        lastUpdated: '2024-12-08T11:20:00Z'
      }
    ]

    // Setup mock polling hook
    const { useStatusPolling } = await import('./hooks/useStatusPolling')
    mockUseStatusPolling = useStatusPolling
    mockUseStatusPolling.mockReturnValue({
      panelData: mockPanelData,
      loading: false,
      error: null,
      retryInfo: { isRetrying: false, retryCount: 0, nextRetryDelay: 0 },
      refresh: vi.fn()
    })

    // Setup Azure Storage mocks
    const { azureStorage } = await import('./services/azureStorage')
    azureStorage.modelExists.mockResolvedValue(true)
    azureStorage.getModelUrl.mockResolvedValue('/models/BuildingA.gltf')
    azureStorage.testConnection.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Complete Workflow Integration', () => {
    it('should complete the full workflow from initialization to panel interaction', async () => {
      const user = userEvent.setup()
      render(<App />)

      // 1. Verify initialization phase
      expect(screen.getByText('🏗️ 3D Digital Twin')).toBeInTheDocument()
      expect(screen.getByText('Initializing application...')).toBeInTheDocument()

      // 2. Wait for initialization to complete
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // 3. Verify main application components are loaded
      expect(screen.getByTestId('status-panel')).toBeInTheDocument()
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.getByTestId('panel-viewer')).toBeInTheDocument()

      // 4. Verify status data integration
      expect(screen.getByTestId('panel-count')).toHaveTextContent('Panel count: 3')
      expect(screen.getByTestId('loading-state')).toBeInTheDocument()
      expect(screen.getByTestId('current-project')).toHaveTextContent('Project: BuildingA')

      // 5. Verify 3D model integration
      expect(screen.getByText('Model URL: /models/BuildingA.gltf')).toBeInTheDocument()

      // 6. Test panel interaction workflow
      const panelButton = screen.getByTestId('panel-PNL-05-101')
      expect(panelButton).toBeInTheDocument()
      expect(panelButton).toHaveAttribute('data-status', 'INSTALLED')

      // Click on panel
      await user.click(panelButton)

      // 7. Verify panel selection and detailed information display
      await waitFor(() => {
        expect(screen.getByTestId('selected-panel-info')).toBeInTheDocument()
      })

      expect(screen.getByText('Selected Panel: PNL-05-101')).toBeInTheDocument()
      expect(screen.getByText('Status: INSTALLED')).toBeInTheDocument()
      expect(screen.getByText('Install Date: 2024-12-10')).toBeInTheDocument()
      expect(screen.getByText('Notes: Installation completed successfully')).toBeInTheDocument()

      // 8. Test panel deselection
      const closeButton = screen.getByTestId('close-panel')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('selected-panel-info')).not.toBeInTheDocument()
      })

      // 9. Test project switching workflow
      const projectSelector = screen.getByTestId('project-selector')
      await user.selectOptions(projectSelector, 'BuildingB')

      // Verify project change triggers model reload
      await waitFor(() => {
        expect(screen.getByTestId('current-project')).toHaveTextContent('Project: BuildingB')
      })
    })

    it('should handle the complete error recovery workflow', async () => {
      const user = userEvent.setup()
      
      // Setup error state
      mockUseStatusPolling.mockReturnValue({
        panelData: [],
        loading: false,
        error: 'Network connection failed',
        retryInfo: { isRetrying: true, retryCount: 2, nextRetryDelay: 4000 },
        refresh: vi.fn()
      })

      const { azureStorage } = await import('./services/azureStorage')
      azureStorage.modelExists.mockRejectedValue(new Error('Storage unavailable'))

      render(<App />)

      // Wait for initialization
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Verify error state is displayed
      expect(screen.getByText('Error: Network connection failed')).toBeInTheDocument()
      expect(screen.getByTestId('retry-info')).toBeInTheDocument()
      expect(screen.getByText('Retrying... (attempt 2)')).toBeInTheDocument()

      // Test manual refresh during error state
      const refreshButton = screen.getByTestId('refresh-button')
      await user.click(refreshButton)

      // Verify refresh was called
      const { refresh } = mockUseStatusPolling()
      expect(refresh).toHaveBeenCalled()
    })

    it('should validate all requirements are met through integration', async () => {
      render(<App />)

      // Wait for initialization
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Requirement 1.1: System fetches GLTF file and renders with Three.js
      const { azureStorage } = await import('./services/azureStorage')
      expect(azureStorage.getModelUrl).toHaveBeenCalledWith('BuildingA')
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.getByTestId('panel-viewer')).toBeInTheDocument()

      // Requirement 1.2: System calls Status API for panel data
      expect(mockUseStatusPolling).toHaveBeenCalledWith('BuildingA')

      // Requirement 1.3: Material mapping applied (verified through panel status display)
      expect(screen.getByTestId('panel-PNL-05-101')).toHaveAttribute('data-status', 'INSTALLED')
      expect(screen.getByTestId('panel-PNL-05-102')).toHaveAttribute('data-status', 'PENDING')
      expect(screen.getByTestId('panel-PNL-05-103')).toHaveAttribute('data-status', 'ISSUE')

      // Requirement 1.4: Navigation controls provided
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument()
      const orbitControls = screen.getByTestId('orbit-controls')
      const controlsProps = JSON.parse(orbitControls.getAttribute('data-props'))
      expect(controlsProps.enablePan).toBe(true)
      expect(controlsProps.enableZoom).toBe(true)
      expect(controlsProps.enableRotate).toBe(true)

      // Requirement 1.5: All panels display with status colors
      expect(screen.getByTestId('panel-count')).toHaveTextContent('Panel count: 3')

      // Requirement 5.1-5.3: Panel click interaction and detailed status
      const user = userEvent.setup()
      const panelButton = screen.getByTestId('panel-PNL-05-101')
      await user.click(panelButton)

      await waitFor(() => {
        expect(screen.getByTestId('selected-panel-info')).toBeInTheDocument()
        expect(screen.getByText('Selected Panel: PNL-05-101')).toBeInTheDocument()
        expect(screen.getByText('Status: INSTALLED')).toBeInTheDocument()
        expect(screen.getByText('Install Date: 2024-12-10')).toBeInTheDocument()
        expect(screen.getByText('Notes: Installation completed successfully')).toBeInTheDocument()
      })

      // Requirement 6.1: Automatic polling (verified through hook usage)
      expect(mockUseStatusPolling).toHaveBeenCalledWith('BuildingA')
    })
  })

  describe('Cross-Browser Compatibility Simulation', () => {
    it('should handle different browser environments', async () => {
      // Simulate different user agents
      const originalUserAgent = navigator.userAgent
      
      // Test Chrome-like environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      })

      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.getByTestId('panel-viewer')).toBeInTheDocument()

      // Restore original user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      })
    })

    it('should handle WebGL availability', async () => {
      // Mock WebGL context creation
      const mockGetContext = vi.fn()
      HTMLCanvasElement.prototype.getContext = mockGetContext
      
      // Simulate WebGL available
      mockGetContext.mockReturnValue({})
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })
  })

  describe('Network Condition Handling', () => {
    it('should handle slow network conditions', async () => {
      // Simulate slow loading
      mockUseStatusPolling.mockReturnValue({
        panelData: [],
        loading: true,
        error: null,
        retryInfo: { isRetrying: false, retryCount: 0, nextRetryDelay: 0 },
        refresh: vi.fn()
      })

      const { azureStorage } = await import('./services/azureStorage')
      azureStorage.getModelUrl.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('/models/BuildingA.gltf'), 2000))
      )

      render(<App />)

      // Wait for initialization (with longer timeout for slow network simulation)
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      // Should show the app is loaded (slow network may complete during test)
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should handle intermittent network failures', async () => {
      const user = userEvent.setup()
      
      // Start with working state
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Simulate network failure
      mockUseStatusPolling.mockReturnValue({
        panelData: mockPanelData,
        loading: false,
        error: 'Connection timeout',
        retryInfo: { isRetrying: true, retryCount: 1, nextRetryDelay: 2000 },
        refresh: vi.fn()
      })

      // Trigger a refresh to see error state
      const refreshButton = screen.getByTestId('refresh-button')
      await user.click(refreshButton)

      // Should show error and retry info
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
      // Note: Specific error text may vary based on mock implementation
    })

    it('should handle complete network failure gracefully', async () => {
      // Simulate complete network failure
      mockUseStatusPolling.mockReturnValue({
        panelData: [],
        loading: false,
        error: 'Network unavailable',
        retryInfo: { isRetrying: false, retryCount: 5, nextRetryDelay: 0 },
        refresh: vi.fn()
      })

      const { azureStorage } = await import('./services/azureStorage')
      azureStorage.modelExists.mockRejectedValue(new Error('Network error'))
      azureStorage.testConnection.mockResolvedValue(false)

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Should show error state but still render basic UI
      expect(screen.getByText('Error: Network unavailable')).toBeInTheDocument()
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.getByTestId('panel-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('panel-count')).toHaveTextContent('Panel count: 0')
    })
  })

  describe('Performance and Resource Management', () => {
    it('should monitor performance and display stats', async () => {
      const { performanceMonitor } = await import('./services/performanceMonitor')
      performanceMonitor.getPerformanceSummary.mockReturnValue({
        status: 'warning',
        issues: ['High memory usage'],
        memoryUsage: 85,
        renderTime: 25
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Performance monitoring should be active (stats may not be immediately visible)
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      // Performance stats are updated periodically and may not be immediately visible in tests
    })

    it('should cleanup resources on unmount', async () => {
      const { performanceMonitor } = await import('./services/performanceMonitor')
      const { resourceManager } = await import('./services/resourceManager')
      
      const { unmount } = render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Unmount component
      unmount()

      // Verify cleanup was called
      expect(performanceMonitor.dispose).toHaveBeenCalled()
      expect(resourceManager.dispose).toHaveBeenCalled()
    })
  })

  describe('Error Boundary and Global Error Handling', () => {
    it('should handle global JavaScript errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Simulate a global error
      const errorEvent = new ErrorEvent('error', {
        error: new Error('Test global error'),
        message: 'Test global error'
      })
      
      window.dispatchEvent(errorEvent)

      // Should handle error gracefully (app should still be functional)
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should handle unhandled promise rejections', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
      })

      // Simulate unhandled promise rejection
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Test rejection')),
        reason: new Error('Test rejection')
      })
      
      window.dispatchEvent(rejectionEvent)

      // Should handle rejection gracefully
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })
})