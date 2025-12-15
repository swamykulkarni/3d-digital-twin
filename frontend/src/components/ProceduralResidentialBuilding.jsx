import { useRef, useMemo, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { StatusType } from '../types/index.ts'
import { MATERIAL_CONFIG, DEFAULT_MATERIAL_COLOR } from '../constants/materials.ts'

/**
 * Procedural Residential Building Component
 * Generates a modular, stacked residential complex similar to the provided image
 */
function ProceduralResidentialBuilding({ panelData, onPanelClick }) {
  const { camera, gl } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const panelMeshes = useRef([])
  const groupRef = useRef()

  // Simple building structure to avoid complex function dependencies
  const buildingStructure = useMemo(() => {
    if (!panelData || panelData.length === 0) {
      // Simple building when no data
      return (
        <group>
          <mesh position={[0, 2, 0]}>
            <boxGeometry args={[4, 4, 2]} />
            <meshStandardMaterial color="#8B7355" />
          </mesh>
        </group>
      )
    }

    // Generate simple modular building with status colors
    const towers = [
      { pos: [-10, 0, 0], size: [4, 3, 4], floors: 4, modules: 3 },
      { pos: [0, 0, 0], size: [5, 3, 5], floors: 5, modules: 4 },
      { pos: [12, 0, 0], size: [4, 3, 4], floors: 6, modules: 3 },
    ]

    return towers.map((tower, towerIndex) => {
      const panelsPerTower = Math.ceil(panelData.length / towers.length)
      const startIndex = towerIndex * panelsPerTower
      const towerPanels = panelData.slice(startIndex, startIndex + panelsPerTower)

      return (
        <group key={`tower-${towerIndex}`} position={tower.pos}>
          {Array.from({ length: tower.floors }, (_, floorIndex) => {
            const floorY = floorIndex * tower.size[1]
            const panelsPerFloor = Math.ceil(towerPanels.length / tower.floors)
            const floorStart = floorIndex * panelsPerFloor
            const floorPanels = towerPanels.slice(floorStart, floorStart + panelsPerFloor)

            // Stagger modules for visual interest
            const offsetX = (floorIndex % 2) * 0.5
            const offsetZ = (floorIndex % 3) * 0.3

            return (
              <group key={`floor-${floorIndex}`} position={[offsetX, floorY, offsetZ]}>
                {/* Floor slab */}
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[tower.size[0], 0.2, tower.size[2]]} />
                  <meshStandardMaterial color="#D3D3D3" />
                </mesh>
                
                {/* Building module */}
                <mesh position={[0, tower.size[1]/2, 0]}>
                  <boxGeometry args={[tower.size[0] * 0.9, tower.size[1], tower.size[2] * 0.9]} />
                  <meshStandardMaterial 
                    color={floorIndex < 2 ? '#D2B48C' : floorIndex < 4 ? '#CD853F' : '#8B4513'}
                    roughness={0.7}
                    metalness={0.2}
                  />
                </mesh>
                
                {/* Glass facade */}
                <mesh position={[0, tower.size[1]/2, tower.size[2]/2]}>
                  <boxGeometry args={[tower.size[0] * 0.85, tower.size[1] * 0.8, 0.05]} />
                  <meshStandardMaterial 
                    color="#87CEEB" 
                    transparent={true} 
                    opacity={0.6}
                    roughness={0.1}
                    metalness={0.1}
                  />
                </mesh>
                
                {/* Balcony for residential floors */}
                {floorIndex > 0 && (
                  <mesh position={[0, tower.size[1]/3, tower.size[2]/2 + 0.3]}>
                    <boxGeometry args={[tower.size[0] * 0.8, 0.1, 0.6]} />
                    <meshStandardMaterial color="#696969" />
                  </mesh>
                )}
                
                {/* Panels on facade */}
                <group position={[0, tower.size[1]/2, tower.size[2]/2 + 0.03]}>
                  {floorPanels.map((panel, panelIndex) => {
                    const panelsPerRow = Math.min(3, floorPanels.length)
                    const col = panelIndex % panelsPerRow
                    const row = Math.floor(panelIndex / panelsPerRow)
                    
                    const panelPos = [
                      (col - (panelsPerRow - 1)/2) * 0.8,
                      (row - 0.5) * 0.6,
                      0.02
                    ]

                    // Get status color
                    const statusType = panel.status || StatusType.NOT_STARTED
                    const materialColor = MATERIAL_CONFIG[statusType]?.color || DEFAULT_MATERIAL_COLOR
                    
                    return (
                      <mesh 
                        key={panel.id} 
                        position={panelPos} 
                        scale={0.4}
                        userData={{ panelId: panel.id }}
                        name={`panel-${panel.id}`}
                      >
                        <boxGeometry args={[0.8, 1.0, 0.05]} />
                        <meshStandardMaterial 
                          color={materialColor}
                          roughness={0.6}
                          metalness={0.4}
                          emissive={materialColor}
                          emissiveIntensity={0.1}
                        />
                      </mesh>
                    )
                  })}
                </group>
              </group>
            )
          })}
        </group>
      )
    })
  }, [panelData])



  // Handle click events
  const handleClick = useCallback((event) => {
    console.log('ProceduralBuilding: Click detected', { 
      panelCount: panelMeshes.current.length, 
      hasCallback: !!onPanelClick 
    })
    
    if (!onPanelClick || panelMeshes.current.length === 0) {
      console.log('ProceduralBuilding: Click ignored - no callback or no panels')
      return
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = gl.domElement.getBoundingClientRect()
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update the raycaster with camera and mouse position
    raycaster.current.setFromCamera(mouse.current, camera)

    // Test intersection with panel meshes
    const intersects = raycaster.current.intersectObjects(panelMeshes.current, false)
    console.log('ProceduralBuilding: Raycaster intersects:', intersects.length)

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      const panelId = clickedMesh.userData?.panelId
      
      console.log('ProceduralBuilding: Mesh clicked', { panelId, userData: clickedMesh.userData })
      
      if (panelId) {
        console.log(`Procedural building panel clicked: ${panelId}`)
        onPanelClick(panelId)
      }
    } else {
      // Click outside any panel - clear selection
      console.log('ProceduralBuilding: Click outside panels')
      onPanelClick(null)
    }
  }, [onPanelClick, camera, gl])

  // Handle mouse move for hover effects
  const handleMouseMove = useCallback((event) => {
    if (panelMeshes.current.length === 0) return

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = gl.domElement.getBoundingClientRect()
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update the raycaster with camera and mouse position
    raycaster.current.setFromCamera(mouse.current, camera)

    // Test intersection with panel meshes
    const intersects = raycaster.current.intersectObjects(panelMeshes.current, false)

    // Reset all panels to normal state
    panelMeshes.current.forEach(mesh => {
      if (mesh.material) {
        mesh.material.emissiveIntensity = 0.1
      }
    })

    // Highlight hovered panel
    if (intersects.length > 0) {
      const hoveredMesh = intersects[0].object
      if (hoveredMesh.material) {
        hoveredMesh.material.emissiveIntensity = 0.3
      }
      gl.domElement.style.cursor = 'pointer'
    } else {
      gl.domElement.style.cursor = 'default'
    }
  }, [camera, gl])

  // Set up event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.style.cursor = 'default'
    }
  }, [handleClick, handleMouseMove, gl])

  // Find and register panel meshes after rendering
  useEffect(() => {
    if (!groupRef.current || !panelData || panelData.length === 0) return

    // Clear previous meshes
    panelMeshes.current = []
    console.log('ProceduralBuilding: Searching for panel meshes...')

    // Find all meshes with panel names in the group
    const findPanelMeshes = (object) => {
      if (object.name && object.name.startsWith('panel-')) {
        const panelId = object.name.replace('panel-', '')
        if (object.userData?.panelId === panelId) {
          panelMeshes.current.push(object)
          console.log(`ProceduralBuilding: Found panel mesh ${panelId}`)
        }
      }
      
      // Recursively search children
      if (object.children) {
        object.children.forEach(findPanelMeshes)
      }
    }

    // Use a timeout to ensure meshes are rendered
    const timer = setTimeout(() => {
      findPanelMeshes(groupRef.current)
      console.log(`ProceduralBuilding: Found ${panelMeshes.current.length} interactive panels (expected ${panelData.length})`)
      
      if (panelMeshes.current.length === 0 && panelData.length > 0) {
        console.log('ProceduralBuilding: Warning - no panel meshes found, trying alternative search...')
        // Alternative: search for meshes with userData.panelId
        groupRef.current.traverse((child) => {
          if (child.userData?.panelId && !panelMeshes.current.includes(child)) {
            panelMeshes.current.push(child)
            console.log(`ProceduralBuilding: Found panel via userData: ${child.userData.panelId}`)
          }
        })
        console.log(`ProceduralBuilding: Alternative search found ${panelMeshes.current.length} panels`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [panelData])

  return (
    <group ref={groupRef}>
      {/* Main building structures */}
      {buildingStructure}
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      

    </group>
  )
}

export default ProceduralResidentialBuilding