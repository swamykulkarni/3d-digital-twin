import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { modelLoader } from '../services/modelLoader.ts'
import { materialService } from '../services/materialService.ts'
import { statusUpdateService } from '../services/statusUpdateService.ts'
import { errorRecoveryService } from '../services/errorRecoveryService.ts'
import { performanceMonitor } from '../services/performanceMonitor.ts'
import { resourceManager } from '../services/resourceManager.ts'
import { renderOptimizer } from '../services/renderOptimizer.ts'
import { progressiveLoader } from '../services/progressiveLoader.ts'
import { MATERIAL_CONFIG, DEFAULT_MATERIAL_COLOR } from '../constants/materials.ts'
import { StatusType } from '../types/index.ts'
import { extractPanelIdFromMeshName } from '../utils/panelId.ts'
import ProceduralResidentialBuilding from './ProceduralResidentialBuilding.jsx'

// GLTF Model Component that handles loaded 3D models
function GLTFModel({ scene, meshPanelMappings, panelStatusMap, panelData, onPanelClick }) {
  const groupRef = useRef()
  const { camera, gl } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const [isInitialized, setIsInitialized] = useState(false)
  const [performanceOptimized, setPerformanceOptimized] = useState(false)

  // Initialize performance monitoring and optimization services
  useEffect(() => {
    if (scene && camera && gl && !performanceOptimized) {
      // Initialize performance monitoring
      performanceMonitor.initialize(gl, scene)
      performanceMonitor.startMonitoring(2000) // Monitor every 2 seconds
      
      // Initialize render optimizer
      renderOptimizer.initialize(gl, scene, camera)
      
      // Initialize progressive loader
      progressiveLoader.initialize(scene, camera)
      
      // Enable resource management auto-cleanup
      resourceManager.enableAutoCleanup(60000, { maxAge: 5 * 60 * 1000 }) // 5 minutes
      
      // Set up performance issue callback
      performanceMonitor.onPerformanceIssues = (issues, metrics) => {
        console.warn('Performance issues detected, applying optimizations:', issues)
        renderOptimizer.adaptiveOptimization()
      }
      
      setPerformanceOptimized(true)
      console.log('Performance optimization services initialized')
    }
    
    return () => {
      if (performanceOptimized) {
        performanceMonitor.stopMonitoring()
        resourceManager.disableAutoCleanup()
      }
    }
  }, [scene, camera, gl, performanceOptimized])

  // Initialize the status update service with mesh mappings
  useEffect(() => {
    if (meshPanelMappings && meshPanelMappings.length > 0) {
      statusUpdateService.setMeshPanelMappings(meshPanelMappings)
      setIsInitialized(true)
      console.log(`Status update service initialized with ${meshPanelMappings.length} mesh mappings`)
      
      // Register meshes with resource manager for tracking
      meshPanelMappings.forEach((mapping, index) => {
        resourceManager.registerResource(mapping.mesh, 'mesh', `panel_mesh_${mapping.panelId}`)
        
        if (mapping.mesh.geometry) {
          resourceManager.registerResource(mapping.mesh.geometry, 'geometry', `panel_geo_${mapping.panelId}`)
        }
        
        if (mapping.mesh.material) {
          const materials = Array.isArray(mapping.mesh.material) ? mapping.mesh.material : [mapping.mesh.material]
          materials.forEach((material, matIndex) => {
            resourceManager.registerResource(material, 'material', `panel_mat_${mapping.panelId}_${matIndex}`)
          })
        }
      })
      
      // Apply LOD optimization for large models
      if (meshPanelMappings.length > 100) {
        console.log('Large model detected, applying LOD optimization')
        renderOptimizer.applyLODToScene()
      }
    }
  }, [meshPanelMappings])

  // Apply initial materials when component first loads
  useEffect(() => {
    if (!meshPanelMappings || !panelStatusMap || !isInitialized) return

    console.log(`Applying initial materials to ${meshPanelMappings.length} panel meshes`)
    
    // Force update all panels for initial load (no animations)
    statusUpdateService.forceUpdateAll(panelData || [], {
      enableAnimations: false,
      batchSize: 20
    }).catch(error => {
      console.error('Failed to apply initial materials:', error)
      // Fallback to direct material service
      materialService.applyMaterialsToMeshes(meshPanelMappings, panelStatusMap)
    })
  }, [meshPanelMappings, panelStatusMap, panelData, isInitialized])

  // Handle efficient status updates when panel data changes
  useEffect(() => {
    if (!isInitialized || !panelData) return

    console.log('Panel data changed, applying efficient status updates...')
    
    // Use the efficient update service with animations
    statusUpdateService.updatePanelStatuses(panelData, {
      enableAnimations: true,
      animationDuration: 500,
      batchSize: 15
    }).catch(error => {
      console.error('Failed to update panel statuses:', error)
      // Fallback to force update without animations
      statusUpdateService.forceUpdateAll(panelData, {
        enableAnimations: false,
        batchSize: 20
      })
    })
  }, [panelData, isInitialized])

  // Handle click events for panel selection
  const handleClick = (event) => {
    if (!meshPanelMappings || !onPanelClick) return

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = gl.domElement.getBoundingClientRect()
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update the raycaster with camera and mouse position
    raycaster.current.setFromCamera(mouse.current, camera)

    // Get all meshes from the mappings for intersection testing
    const meshes = meshPanelMappings.map(mapping => mapping.mesh)
    const intersects = raycaster.current.intersectObjects(meshes, false)

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      
      // Find the panel ID for the clicked mesh
      const mapping = meshPanelMappings.find(m => m.mesh === clickedMesh)
      if (mapping) {
        console.log(`Panel clicked: ${mapping.panelId}`)
        onPanelClick(mapping.panelId)
      } else {
        // Fallback: try to extract Panel ID from mesh name
        const panelId = extractPanelIdFromMeshName(clickedMesh.name)
        if (panelId) {
          console.log(`Panel clicked (fallback): ${panelId}`)
          onPanelClick(panelId)
        }
      }
    } else {
      // Click outside any panel - clear selection
      onPanelClick(null)
    }
  }

  // Add click event listener and performance optimization loop
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('click', handleClick)
    
    // Set up performance optimization loop
    let animationId
    const optimizationLoop = () => {
      if (performanceOptimized) {
        // Perform frustum culling
        renderOptimizer.performFrustumCulling()
        
        // Update distance-based loading
        progressiveLoader.updateDistanceBasedLoading()
        
        // Collect performance metrics
        performanceMonitor.collectMetrics()
      }
      
      animationId = requestAnimationFrame(optimizationLoop)
    }
    
    if (performanceOptimized) {
      optimizationLoop()
    }
    
    return () => {
      canvas.removeEventListener('click', handleClick)
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [meshPanelMappings, onPanelClick, camera, gl, performanceOptimized])

  if (!scene) return null

  return <primitive ref={groupRef} object={scene} />
}

// Fallback building component for when no GLTF model is available
function FallbackBuilding({ panelData, onPanelClick }) {
  // Use the new procedural residential building
  return <ProceduralResidentialBuilding panelData={panelData} onPanelClick={onPanelClick} />
}

function PanelViewer({ panelData, gltfUrl, projectId = 'default', onPanelClick }) {
  const [modelData, setModelData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fallbackMode, setFallbackMode] = useState(false)

  // Create panel status map for efficient lookups
  const panelStatusMap = useMemo(() => {
    const map = new Map()
    if (panelData && Array.isArray(panelData)) {
      panelData.forEach(panel => {
        map.set(panel.id, panel)
      })
    }
    return map
  }, [panelData])

  // Monitor error recovery service for fallback mode
  useEffect(() => {
    const updateFallbackMode = () => {
      const errorState = errorRecoveryService.getErrorState()
      setFallbackMode(errorState.hasStorageError)
    }

    // Set up callbacks for error recovery events
    errorRecoveryService.setCallbacks({
      onRecoveryStart: updateFallbackMode,
      onRecoverySuccess: updateFallbackMode,
      onRecoveryFailed: updateFallbackMode,
      onFullRecovery: updateFallbackMode
    })

    // Initial check
    updateFallbackMode()
  }, [])

  // Load GLTF model when URL is provided
  useEffect(() => {
    if (!gltfUrl) {
      console.log(`No GLTF URL provided for project ${projectId}, using fallback building`)
      setModelData(null)
      setError(null)
      setFallbackMode(true) // Enable fallback mode when no URL is provided
      return
    }

    const loadModel = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log(`Loading GLTF model: ${gltfUrl}`)
        const result = await modelLoader.loadModel(gltfUrl, projectId)
        
        setModelData(result)
        setFallbackMode(false) // Successfully loaded, exit fallback mode
        console.log(`Model loaded successfully with ${result.meshPanelMappings.length} panel meshes`)
        
        if (result.warnings.length > 0) {
          console.warn('Model loading warnings:', result.warnings)
        }
      } catch (err) {
        console.error('Failed to load GLTF model:', err)
        setError(err.message)
        setModelData(null)
        setFallbackMode(true) // Enter fallback mode on error
        
        // Show user-friendly error message
        const userFriendlyError = err.message.includes('404') || err.message.includes('Not Found')
          ? 'Model file not found. Using simplified 3D view.'
          : err.message.includes('network') || err.message.includes('CORS')
          ? 'Network error loading model. Using simplified 3D view.'
          : 'Error loading 3D model. Using simplified 3D view.'
        
        setError(userFriendlyError)
      } finally {
        setLoading(false)
      }
    }

    loadModel()

    // Cleanup function to dispose of Three.js resources
    return () => {
      if (modelData?.scene) {
        modelLoader.disposeModel(modelData.scene)
      }
      // Reset the status update service when model changes
      statusUpdateService.reset()
    }
  }, [gltfUrl, projectId])

  // Reset status update service when project changes
  useEffect(() => {
    statusUpdateService.reset()
    console.log(`Status update service reset for project: ${projectId}`)
  }, [projectId])

  // Render loading state with better visual feedback
  if (loading) {
    return (
      <group>
        {/* Loading indicator */}
        <mesh position={[0, 20, 0]}>
          <boxGeometry args={[8, 0.5, 0.1]} />
          <meshStandardMaterial color="#4CAF50" />
        </mesh>
        
        {/* Show procedural building while loading */}
        <FallbackBuilding panelData={panelData} onPanelClick={onPanelClick} />
      </group>
    )
  }

  // Always show fallback building in error/fallback mode or when no model data
  const shouldUseFallback = fallbackMode || error || !modelData

  return (
    <group>
      {/* Status indicator for fallback mode */}
      {shouldUseFallback && error && (
        <mesh position={[0, 8, 0]}>
          <boxGeometry args={[6, 0.3, 0.1]} />
          <meshStandardMaterial color="#FF9800" />
        </mesh>
      )}

      {/* Render GLTF model if available and not in fallback mode, otherwise procedural building */}
      {!shouldUseFallback && modelData ? (
        <GLTFModel 
          scene={modelData.scene}
          meshPanelMappings={modelData.meshPanelMappings}
          panelStatusMap={panelStatusMap}
          panelData={panelData}
          onPanelClick={onPanelClick}
        />
      ) : (
        <FallbackBuilding 
          panelData={panelData} 
          onPanelClick={onPanelClick}
        />
      )}
    </group>
  )
}

export default PanelViewer