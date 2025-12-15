import { useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import PanelViewer from './components/PanelViewer'
import StatusPanel from './components/StatusPanel'
import { useStatusPolling } from './hooks/useStatusPolling'
import { errorRecoveryService } from './services/errorRecoveryService'
import { azureStorage } from './services/azureStorage'
import { performanceMonitor } from './services/performanceMonitor'
import { resourceManager } from './services/resourceManager'
import { getAzureConfig, validateAzureConfig } from './config/azureConfig'

function App() {
  const [selectedProject, setSelectedProject] = useState('BuildingA')
  const [selectedPanel, setSelectedPanel] = useState(null)
  const [appError, setAppError] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [modelLoadingState, setModelLoadingState] = useState({
    loading: false,
    error: null,
    gltfUrl: null
  })
  const [performanceStats, setPerformanceStats] = useState(null)

  // Use the polling hook for automatic status updates
  const { panelData, loading: statusLoading, error, retryInfo, refresh } = useStatusPolling(selectedProject)

  // Compute overall loading state
  const loading = useMemo(() => {
    return isInitializing || statusLoading || modelLoadingState.loading
  }, [isInitializing, statusLoading, modelLoadingState.loading])

  // Compute overall error state
  const overallError = useMemo(() => {
    return appError || error || modelLoadingState.error
  }, [appError, error, modelLoadingState.error])

  // Get GLTF URL for the selected project with enhanced Azure Storage integration
  const getGltfUrl = useCallback(async (projectId) => {
    try {
      setModelLoadingState(prev => ({ ...prev, loading: true, error: null }))
      
      // ResidentialComplex always uses procedural building - skip Azure Storage check
      if (projectId === 'ResidentialComplex') {
        console.log(`Project ${projectId} uses procedural building, skipping Azure Storage`)
        setModelLoadingState(prev => ({ 
          ...prev, 
          loading: false, 
          gltfUrl: null,
          error: null 
        }))
        return null
      }
      
      // Check if model exists in Azure Storage first (if method exists)
      let modelExists = false
      if (typeof azureStorage.modelExists === 'function') {
        modelExists = await azureStorage.modelExists(projectId)
      }
      
      if (modelExists) {
        // Get secure URL from Azure Storage with caching
        const url = await azureStorage.getModelUrl(projectId)
        
        setModelLoadingState(prev => ({ 
          ...prev, 
          loading: false, 
          gltfUrl: url,
          error: null 
        }))
        
        console.log(`Model URL retrieved for ${projectId}: ${url}`)
        return url
      } else {
        // Model doesn't exist in Azure Storage, use fallback
        console.warn(`Model not found in Azure Storage for project ${projectId}, using fallback`)
        setModelLoadingState(prev => ({ 
          ...prev, 
          loading: false, 
          error: null, // Don't show error for expected fallback behavior
          gltfUrl: null 
        }))
        return null
      }
    } catch (err) {
      console.warn(`Failed to get GLTF URL for project ${projectId}:`, err)
      setModelLoadingState(prev => ({ 
        ...prev, 
        loading: false, 
        error: `Model loading error for ${projectId} - using simplified 3D view`,
        gltfUrl: null 
      }))
      return null
    }
  }, [])

  // Initialize application and set up error recovery service callbacks
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing 3D Digital Twin application...')
        
        // Initialize Azure Storage service with configuration
        try {
          const azureConfig = getAzureConfig()
          const validation = validateAzureConfig(azureConfig)
          
          if (validation.isValid && (azureConfig.connectionString || (azureConfig.accountName && azureConfig.accountKey))) {
            // Initialize with real Azure Storage credentials
            azureStorage.initialize(azureConfig)
            console.log('Azure Storage service initialized with credentials')
          } else {
            // Log validation errors if any
            if (!validation.isValid) {
              console.warn('Azure Storage configuration validation failed:', validation.errors)
            }
            console.log('Azure Storage service running in demo mode (no credentials provided)')
          }
          
          // Update retry configuration if method exists
          if (typeof azureStorage.updateRetryConfig === 'function') {
            azureStorage.updateRetryConfig({
              maxRetries: azureConfig.maxRetries,
              baseDelay: azureConfig.baseDelay,
              maxDelay: azureConfig.maxDelay,
              backoffMultiplier: 2
            })
          }
          
        } catch (storageError) {
          console.warn('Azure Storage initialization failed, using demo mode:', storageError)
        }
        
        // Set up error recovery callbacks
        errorRecoveryService.setCallbacks({
          onRecoveryStart: () => {
            console.log('App: Error recovery started')
            setAppError(null)
          },
          onRecoverySuccess: (service) => {
            console.log(`App: ${service} recovery successful`)
            // Clear model loading error if storage recovery succeeded
            if (service === 'storage') {
              setModelLoadingState(prev => ({ ...prev, error: null }))
            }
          },
          onRecoveryFailed: (service, error) => {
            console.log(`App: ${service} recovery failed:`, error)
            if (service === 'storage') {
              // Don't show storage errors for ResidentialComplex since it uses procedural building
              if (selectedProject !== 'ResidentialComplex') {
                setModelLoadingState(prev => ({ 
                  ...prev, 
                  error: 'Model storage unavailable - using fallback 3D view' 
                }))
              }
            }
          },
          onFullRecovery: () => {
            console.log('App: Full recovery completed')
            setAppError(null)
            setModelLoadingState(prev => ({ ...prev, error: null }))
          }
        })

        // Test Azure Storage connectivity if method exists (but not for ResidentialComplex)
        let storageConnected = false
        if (typeof azureStorage.testConnection === 'function') {
          storageConnected = await azureStorage.testConnection()
        }
        console.log(`Azure Storage connectivity: ${storageConnected ? 'Connected' : 'Demo mode'}`)
        
        // Don't trigger storage errors for ResidentialComplex since it uses procedural building
        if (selectedProject === 'ResidentialComplex' && !storageConnected) {
          console.log('ResidentialComplex project - skipping storage error reporting')
        }

        // Configure error recovery service for initial project
        if (selectedProject === 'ResidentialComplex') {
          errorRecoveryService.setIgnoreStorageErrors(true)
          console.log('App: Initial project is ResidentialComplex - ignoring storage errors')
        }

        // Load initial GLTF model for the default project
        await getGltfUrl(selectedProject)
        
        setIsInitializing(false)
        // Set up performance monitoring interval
        const performanceInterval = setInterval(() => {
          const stats = performanceMonitor.getPerformanceSummary()
          setPerformanceStats(stats)
          
          // Log performance warnings
          if (stats.status === 'warning' || stats.status === 'critical') {
            console.warn(`Performance ${stats.status}:`, stats.issues)
          }
        }, 5000) // Update every 5 seconds
        
        // Store interval for cleanup
        window.performanceInterval = performanceInterval
        
        console.log('Application initialization complete')
      } catch (err) {
        console.error('Failed to initialize application:', err)
        setAppError('Failed to initialize application. Please refresh the page.')
        setIsInitializing(false)
      }
    }

    initializeApp()

    // Handle global errors
    const handleGlobalError = (event) => {
      console.error('Global error caught:', event.error)
      setAppError('An unexpected error occurred. Please refresh the page.')
    }

    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      setAppError('A network error occurred. Please check your connection.')
    }

    window.addEventListener('error', handleGlobalError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleGlobalError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      
      // Cleanup performance monitoring
      if (window.performanceInterval) {
        clearInterval(window.performanceInterval)
      }
      
      // Cleanup services
      performanceMonitor.dispose()
      resourceManager.dispose()
    }
  }, [selectedProject, getGltfUrl])

  // Handle project changes - load new GLTF model
  useEffect(() => {
    if (!isInitializing) {
      console.log(`Project changed to: ${selectedProject}`)
      getGltfUrl(selectedProject)
    }
  }, [selectedProject, isInitializing, getGltfUrl])

  // Handle panel click - find panel data and set as selected
  const handlePanelClick = useCallback((panelId) => {
    try {
      if (!panelId) {
        setSelectedPanel(null)
        return
      }

      console.log(`Panel selected: ${panelId}`)

      // Find the panel data for the clicked panel
      const panel = panelData.find(p => p.id === panelId)
      if (panel) {
        setSelectedPanel({
          id: panel.id,
          status: panel.status,
          installDate: panel.installDate,
          notes: panel.notes,
          lastUpdated: panel.lastUpdated
        })
      } else {
        // Panel ID exists but no status data - create minimal panel info
        setSelectedPanel({
          id: panelId,
          status: undefined,
          installDate: undefined,
          notes: 'No status data available for this panel',
          lastUpdated: undefined
        })
      }
    } catch (err) {
      console.error('Error handling panel click:', err)
      setAppError('Error selecting panel. Please try again.')
    }
  }, [panelData])

  // Enhanced refresh function with error handling
  const handleRefresh = useCallback(async () => {
    try {
      console.log('Refreshing application data...')
      setAppError(null)
      
      // Refresh status data
      await refresh()
      
      // Refresh model data if needed
      if (modelLoadingState.error) {
        await getGltfUrl(selectedProject)
      }
      
      // Also trigger error recovery if there are any errors
      if (errorRecoveryService.hasErrors()) {
        await errorRecoveryService.forceRecovery()
      }
      
      console.log('Application refresh completed')
    } catch (err) {
      console.error('Error during refresh:', err)
      setAppError('Failed to refresh data. Please try again.')
    }
  }, [refresh, modelLoadingState.error, selectedProject, getGltfUrl])

  // Handle project change with proper state management
  const handleProjectChange = useCallback((newProject) => {
    console.log(`Changing project from ${selectedProject} to ${newProject}`)
    setSelectedProject(newProject)
    setSelectedPanel(null) // Clear panel selection when changing projects
    setAppError(null) // Clear any app-level errors
    
    // Configure error recovery service based on project type
    if (newProject === 'ResidentialComplex') {
      // ResidentialComplex uses procedural building, so ignore storage errors
      errorRecoveryService.setIgnoreStorageErrors(true)
      console.log('App: Ignoring storage errors for ResidentialComplex project')
    } else {
      // Other projects may use Azure Storage, so enable storage error reporting
      errorRecoveryService.setIgnoreStorageErrors(false)
      console.log('App: Enabling storage error reporting for', newProject)
    }
  }, [selectedProject])



  // Render loading screen during initialization
  if (isInitializing) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #87CEEB 0%, #DEB887 100%)',
        color: 'white',
        fontFamily: 'monospace'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>
            🏗️ 3D Digital Twin
          </div>
          <div style={{ fontSize: '16px', opacity: 0.8 }}>
            Initializing application...
          </div>
          <div style={{ 
            width: '200px', 
            height: '4px', 
            background: 'rgba(255,255,255,0.3)', 
            borderRadius: '2px',
            margin: '20px auto',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'white',
              borderRadius: '2px',
              animation: 'loading 2s ease-in-out infinite'
            }} />
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Enhanced Status Panel with integrated state */}
      <StatusPanel 
        panelData={panelData}
        loading={loading}
        error={overallError}
        selectedProject={selectedProject}
        onProjectChange={handleProjectChange}
        onRefresh={handleRefresh}
        retryInfo={retryInfo}
        selectedPanel={selectedPanel}
        onClosePanel={() => setSelectedPanel(null)}
        performanceStats={performanceStats}
      />
      
      {/* Loading overlay for ongoing operations */}
      {(statusLoading || modelLoadingState.loading) && !isInitializing && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500,
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '10px' }}>
              {statusLoading && 'Loading panel status...'}
              {modelLoadingState.loading && 'Loading 3D model...'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              Please wait...
            </div>
          </div>
        </div>
      )}
      
      {/* 3D Canvas with integrated PanelViewer */}
      <Canvas
        camera={{ position: [15, 8, 15], fov: 60 }}
        style={{ background: 'linear-gradient(to bottom, #87CEEB 0%, #DEB887 100%)' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 20, 10]} intensity={1.2} castShadow />
        <directionalLight position={[-10, 10, 5]} intensity={0.5} />
        <pointLight position={[0, 15, 0]} intensity={0.8} color="#FFA500" />
        
        <PanelViewer 
          panelData={panelData} 
          gltfUrl={modelLoadingState.gltfUrl}
          projectId={selectedProject}
          onPanelClick={handlePanelClick}
        />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI * 0.75} // Prevent camera from going below ground
          minDistance={5}
          maxDistance={50}
        />
        <Environment preset="sunset" />
      </Canvas>
    </div>
  )
}

export default App