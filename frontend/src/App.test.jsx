import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock the services and hooks
vi.mock('./hooks/useStatusPolling', () => ({
  useStatusPolling: vi.fn(() => ({
    panelData: [
      { id: 'PNL-05-101', status: 'INSTALLED', installDate: '2024-12-10', notes: 'Test panel' },
      { id: 'PNL-05-102', status: 'PENDING', installDate: null, notes: 'Pending panel' }
    ],
    loading: false,
    error: null,
    retryInfo: { isRetrying: false, retryCount: 0, nextRetryDelay: 0 },
    refresh: vi.fn()
  }))
}))

vi.mock('./services/errorRecoveryService', () => ({
  errorRecoveryService: {
    setCallbacks: vi.fn(),
    hasErrors: vi.fn(() => false),
    forceRecovery: vi.fn(),
    getErrorState: vi.fn(() => ({ hasStorageError: false })),
    setIgnoreStorageErrors: vi.fn()
  }
}))

vi.mock('./services/azureStorage', () => ({
  azureStorage: {
    getModelUrl: vi.fn(() => Promise.resolve('/models/test.gltf'))
  }
}))

// Mock Three.js components
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="canvas">{children}</div>
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Environment: () => <div data-testid="environment" />
}))

vi.mock('./components/PanelViewer', () => ({
  default: ({ panelData, onPanelClick }) => (
    <div data-testid="panel-viewer">
      <div>Panel count: {panelData?.length || 0}</div>
      <button onClick={() => onPanelClick('PNL-05-101')}>Click Panel</button>
    </div>
  )
}))

vi.mock('./components/StatusPanel', () => ({
  default: ({ panelData, loading, error, selectedPanel, onClosePanel }) => (
    <div data-testid="status-panel">
      <div>Loading: {loading ? 'true' : 'false'}</div>
      <div>Error: {error || 'none'}</div>
      <div>Panel count: {panelData?.length || 0}</div>
      {selectedPanel && (
        <div data-testid="selected-panel">
          Selected: {selectedPanel.id}
          <button onClick={onClosePanel}>Close</button>
        </div>
      )}
    </div>
  )
}))

describe('App Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the main app with all integrated components', async () => {
    render(<App />)
    
    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
    })

    // Check that main components are rendered
    expect(screen.getByTestId('status-panel')).toBeInTheDocument()
    expect(screen.getByTestId('canvas')).toBeInTheDocument()
    expect(screen.getByTestId('panel-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument()
    expect(screen.getByTestId('environment')).toBeInTheDocument()
  })

  it('should display loading state during initialization', () => {
    render(<App />)
    
    // Should show initialization screen initially
    expect(screen.getByText('🏗️ 3D Digital Twin')).toBeInTheDocument()
    expect(screen.getByText('Initializing application...')).toBeInTheDocument()
  })

  it('should integrate status data with 3D visualization', async () => {
    render(<App />)
    
    // Wait for initialization and loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
    })

    // Wait for model loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading 3D model...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Check that panel data is passed to components
    expect(screen.getAllByText('Panel count: 2')).toHaveLength(2) // Both StatusPanel and PanelViewer show count
    expect(screen.getByText('Loading: false')).toBeInTheDocument()
    expect(screen.getByText('Error: none')).toBeInTheDocument() // No error should be shown since storage errors are ignored for BuildingA
  })

  it('should handle panel selection and display detailed information', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
    })

    // Click on a panel
    const clickPanelButton = screen.getByText('Click Panel')
    clickPanelButton.click()

    // Check that selected panel is displayed
    await waitFor(() => {
      expect(screen.getByTestId('selected-panel')).toBeInTheDocument()
      expect(screen.getByText('Selected: PNL-05-101')).toBeInTheDocument()
    })

    // Close panel selection
    const closeButton = screen.getByText('Close')
    closeButton.click()

    // Check that selection is cleared
    await waitFor(() => {
      expect(screen.queryByTestId('selected-panel')).not.toBeInTheDocument()
    })
  })

  it('should manage application state correctly', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
    })

    // Verify that error recovery service is set up
    const { errorRecoveryService } = await import('./services/errorRecoveryService')
    expect(errorRecoveryService.setCallbacks).toHaveBeenCalled()
  })

  it('should handle error states appropriately', async () => {
    // Mock error state
    const { useStatusPolling } = await import('./hooks/useStatusPolling')
    useStatusPolling.mockReturnValue({
      panelData: [],
      loading: false,
      error: 'Connection failed',
      retryInfo: { isRetrying: true, retryCount: 2, nextRetryDelay: 5000 },
      refresh: vi.fn()
    })

    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument()
    })

    // Check that error is displayed
    expect(screen.getByText('Error: Connection failed')).toBeInTheDocument()
  })
})