# Procedural Residential Building Guide

## Overview

The 3D Digital Twin application now includes a procedural residential building generator that creates a modular, stacked residential complex similar to modern architectural designs. This feature is automatically used when:

1. No GLTF model is available for a project
2. The "ResidentialComplex" project is selected
3. There are model loading errors (fallback mode)

## Features

### Architecture Design
- **Two Main Tower Complexes**: Left and right tower groups with different heights and configurations
- **Modular Stacking**: Buildings are composed of individual modules that can be stacked and offset
- **Realistic Materials**: Different materials for base, residential, and penthouse levels
- **Architectural Details**: Includes balconies, glass facades, window frames, and rooftop gardens

### Interactive Elements
- **Clickable Panels**: Each residential unit has interactive panels that show status information
- **Status Colors**: Panels change color based on their installation status:
  - 🟢 Green: INSTALLED
  - 🟡 Yellow: PENDING  
  - 🔴 Red: ISSUE
  - ⚫ Gray: NOT_STARTED

### Visual Features
- **Realistic Lighting**: Multiple light sources including ambient, directional, and point lights
- **Landscaping**: Ground plane, pathways, and surrounding trees
- **Material Variety**: Different textures and colors for various building elements
- **Atmospheric Effects**: Gradient sky background and evening lighting

## How to Access

### Method 1: Select ResidentialComplex Project
1. Open the application at http://localhost:5173
2. In the Status Panel (top-left), change the Project dropdown to "Residential Complex"
3. The procedural building will load automatically with 22 interactive panels

### Method 2: Automatic Fallback
The procedural building automatically appears when:
- GLTF model files are not available
- Network errors prevent model loading
- Azure Storage is not configured

## Panel Data Structure

The ResidentialComplex project includes 22 panels distributed across:

### Left Tower Complex (8 panels)
- **Ground Floor**: RES-L1-001, RES-L1-002
- **Residential Floors**: RES-L2-001, RES-L2-002, RES-L3-001, RES-L3-002, RES-L4-001
- **Penthouse**: RES-L5-001

### Right Tower Complex (12 panels)  
- **Ground Floor**: RES-R1-001, RES-R1-002, RES-R1-003
- **Residential Floors**: RES-R2-001, RES-R2-002, RES-R2-003, RES-R3-001, RES-R3-002, RES-R4-001, RES-R4-002, RES-R5-001
- **Penthouse**: RES-R6-001

### Central Elements (2 panels)
- **Plaza**: RES-C1-001
- **Bridge**: RES-C2-001

## Technical Implementation

### Components
- **ProceduralResidentialBuilding.jsx**: Main building generator component
- **PanelViewer.jsx**: Updated to use procedural building as fallback
- **Backend**: Extended with ResidentialComplex project data

### Key Features
- **Modular Design**: Each building module is independently configurable
- **Panel Distribution**: Panels are automatically distributed across modules
- **Click Detection**: Ray casting for interactive panel selection
- **Performance Optimized**: Efficient rendering with proper material management

## Customization

The building configuration can be modified in `ProceduralResidentialBuilding.jsx`:

```javascript
const buildingConfig = {
  towers: [
    {
      name: 'LeftComplex',
      basePosition: [-15, 0, 0],
      modules: [
        { pos: [0, 0, 0], size: [4, 3, 6], color: '#D2B48C', type: 'base' },
        // Add more modules...
      ]
    }
  ]
}
```

### Customizable Properties
- **Module Positions**: 3D coordinates for each building module
- **Module Sizes**: Width, height, depth for each module
- **Colors**: Material colors for different building types
- **Types**: 'base', 'residential', 'penthouse' with different visual features

## Testing

To test the procedural building:

1. **Start the servers**:
   ```bash
   # Backend
   cd backend && npm run dev
   
   # Frontend  
   cd frontend && npm run dev
   ```

2. **Access the application**: http://localhost:5173

3. **Switch to ResidentialComplex**: Use the project dropdown in the Status Panel

4. **Interact with panels**: Click on the colored panels on building facades to see status information

5. **Navigate the 3D scene**: Use mouse to orbit, zoom, and pan around the building

## Status Information

Each panel shows detailed information when clicked:
- **Panel ID**: Unique identifier (e.g., RES-L1-001)
- **Status**: Current installation status
- **Install Date**: When the panel was installed (if applicable)
- **Notes**: Detailed information about the panel
- **Last Updated**: Timestamp of last status update

## Performance

The procedural building is optimized for performance:
- **Efficient Geometry**: Reused geometries and materials
- **LOD Ready**: Prepared for Level of Detail optimization
- **Memory Management**: Proper cleanup and resource management
- **Responsive**: Smooth interaction even with many panels

## Future Enhancements

Potential improvements for the procedural building system:
- **Dynamic Module Generation**: Generate modules based on panel data
- **Animation System**: Animated construction sequences
- **Weather Effects**: Rain, snow, day/night cycles
- **Interior Views**: Ability to see inside residential units
- **Customizable Layouts**: User-configurable building designs