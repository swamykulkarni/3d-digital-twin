# 3D Digital Twin System Design

## Overview

The 3D Digital Twin system is a web-based application that provides real-time visualization of building facade panel installation status. The system consists of a React frontend using Three.js for 3D rendering, a Node.js/Express backend API for status data, and Azure Blob Storage for 3D model hosting. The architecture enables designers to upload GLTF models with named panel meshes, while construction teams can monitor installation progress through color-coded 3D visualization.

## Architecture

The system follows a client-server architecture with clear separation between presentation, business logic, and data storage:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server  │    │ Azure Blob      │
│   + Three.js    │◄──►│  + Status API    │    │ Storage         │
│                 │    │                  │    │ (.gltf files)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │   Database      │
         └──────────────┤ (Panel Status)  │
                        └─────────────────┘
```

### Key Architectural Decisions

1. **Client-Side 3D Rendering**: Three.js runs in the browser to leverage GPU acceleration and reduce server load
2. **RESTful API Design**: Simple HTTP endpoints for status data retrieval and updates
3. **Cloud Storage Integration**: Azure Blob Storage provides scalable, CDN-enabled model hosting
4. **Polling Strategy**: Client-side polling for status updates with exponential backoff for resilience

## Components and Interfaces

### Frontend Components

#### PanelViewer Component
- **Purpose**: Main 3D visualization component using Three.js
- **Responsibilities**:
  - Load GLTF models from Azure Blob Storage
  - Render 3D scene with camera controls
  - Apply material mapping based on panel status
  - Handle user interactions (clicks, navigation)
- **Key Methods**:
  - `loadModel(gltfUrl)`: Loads and parses GLTF file
  - `updatePanelColors(statusData)`: Maps status to material colors
  - `handlePanelClick(mesh)`: Processes user panel selection

#### StatusPanel Component  
- **Purpose**: Displays detailed information for selected panels
- **Responsibilities**:
  - Show panel details when user clicks on 3D mesh
  - Format status information for display
  - Handle panel selection state
- **Props Interface**:
  ```typescript
  interface StatusPanelProps {
    selectedPanel: PanelInfo | null;
    onClose: () => void;
  }
  ```

#### App Component
- **Purpose**: Root component managing application state
- **Responsibilities**:
  - Coordinate between PanelViewer and StatusPanel
  - Manage status data fetching and polling
  - Handle error states and loading indicators

### Backend Components

#### Status API Controller
- **Endpoints**:
  - `GET /api/status?project={projectId}`: Retrieve all panel statuses
  - `GET /api/status/{panelId}`: Get specific panel details
  - `PUT /api/status/{panelId}`: Update panel status
- **Response Format**:
  ```json
  {
    "panels": [
      {
        "id": "PNL-05-101",
        "status": "INSTALLED",
        "installDate": "2024-12-10",
        "notes": "Installation completed successfully"
      }
    ]
  }
  ```

#### Model Service
- **Purpose**: Handle GLTF model validation and metadata extraction
- **Methods**:
  - `validateModel(gltfFile)`: Check mesh naming conventions
  - `extractPanelIds(gltfFile)`: Parse Panel IDs from mesh names
  - `generateModelMetadata(gltfFile)`: Create model index for faster loading

## Data Models

### Panel Status Model
```typescript
interface PanelStatus {
  id: string;           // Panel ID (e.g., "PNL-05-101")
  status: StatusType;   // INSTALLED | PENDING | ISSUE | NOT_STARTED
  installDate?: Date;   // When panel was installed
  notes?: string;       // Additional status information
  lastUpdated: Date;    // Timestamp of last status change
}

enum StatusType {
  INSTALLED = "INSTALLED",
  PENDING = "PENDING", 
  ISSUE = "ISSUE",
  NOT_STARTED = "NOT_STARTED"
}
```

### 3D Model Metadata
```typescript
interface ModelMetadata {
  projectId: string;
  gltfUrl: string;
  panelCount: number;
  panelIds: string[];
  uploadDate: Date;
  version: string;
}
```

### Material Configuration
```typescript
interface MaterialConfig {
  [StatusType.INSTALLED]: { color: 0x00ff00 };    // Green
  [StatusType.PENDING]: { color: 0xffff00 };      // Yellow  
  [StatusType.ISSUE]: { color: 0xff0000 };        // Red
  [StatusType.NOT_STARTED]: { color: 0x808080 };  // Gray
}
```
## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all testable properties from the prework analysis, several can be consolidated to eliminate redundancy:

- Properties 2.1-2.4 (individual status color mappings) can be combined into a single comprehensive status-to-color mapping property
- Properties 5.1-5.3 (panel click handling) can be combined into a comprehensive click interaction property
- Properties 6.2-6.3 (status updates and transitions) can be combined into a single update behavior property

### Core Properties

**Property 1: Status-to-color mapping consistency**
*For any* panel with a valid status (INSTALLED, PENDING, ISSUE, or no status), the system should render that panel with the correct material color (green, yellow, red, or gray respectively)
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

**Property 2: Geometry preservation during material updates**
*For any* panel mesh, applying status colors should preserve the original mesh geometry and only modify material properties
**Validates: Requirements 2.5**

**Property 3: Panel ID extraction consistency**
*For any* GLTF file with properly named meshes, the system should correctly extract Panel IDs from mesh names and create accurate mesh-to-Panel ID mappings
**Validates: Requirements 3.2, 3.3**

**Property 4: Invalid mesh name handling**
*For any* mesh with a name that doesn't match Panel ID format, the system should log a warning and apply default gray material
**Validates: Requirements 3.4**

**Property 5: Duplicate Panel ID consistency**
*For any* set of meshes sharing the same Panel ID, all meshes should receive identical status colors when status updates are applied
**Validates: Requirements 3.5**

**Property 6: Error logging completeness**
*For any* error condition that occurs during system operation, detailed error information should be logged for debugging purposes
**Validates: Requirements 4.5**

**Property 7: Panel click interaction completeness**
*For any* clickable panel mesh, clicking should identify the correct Panel ID and display all required status information (Panel ID, status, installation date, notes)
**Validates: Requirements 5.1, 5.2, 5.3**

**Property 8: Status update efficiency**
*For any* new status data received, the system should update only panels whose status has actually changed, leaving unchanged panels unmodified
**Validates: Requirements 6.2**

**Property 9: Status transition consistency**
*For any* panel status change, the system should apply the new status color through a smooth material transition
**Validates: Requirements 6.3**

**Property 10: Model loading completeness**
*For any* successfully loaded GLTF model, all panel meshes should have appropriate status colors applied based on current status data
**Validates: Requirements 1.5**

**Property 11: GLTF validation consistency**
*For any* GLTF file uploaded to the system, mesh naming validation should correctly identify valid and invalid Panel ID formats
**Validates: Requirements 3.1**

## Error Handling

### Network Error Resilience
- **API Failures**: When status API calls fail, display 3D model with default materials and show user-friendly error message
- **Storage Failures**: When Azure Blob Storage is unreachable, show loading error with retry button
- **Automatic Recovery**: Implement exponential backoff for failed requests with automatic retry when connectivity is restored

### Model Loading Errors
- **Invalid GLTF**: Validate GLTF structure and show specific error messages for malformed files
- **Missing Meshes**: Handle cases where expected panel meshes are not found in the model
- **Naming Violations**: Log warnings for meshes that don't follow Panel ID naming conventions

### Runtime Error Handling
- **Memory Management**: Monitor Three.js memory usage and dispose of unused resources
- **Performance Degradation**: Implement fallback rendering modes for low-performance devices
- **State Corruption**: Validate application state consistency and recover from invalid states

## Testing Strategy

### Dual Testing Approach

The system will use both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests** will verify:
- Specific examples of status-to-color mapping
- Error handling for known failure scenarios  
- Integration between React components and Three.js
- API endpoint responses and error cases

**Property-Based Tests** will verify:
- Universal properties across all possible inputs using **fast-check** library
- Each property-based test will run a minimum of 100 iterations
- Tests will be tagged with comments referencing design document properties

### Property-Based Testing Configuration

- **Library**: fast-check (JavaScript/TypeScript property testing library)
- **Iterations**: Minimum 100 per property test
- **Tagging Format**: Each test tagged as `**Feature: 3d-digital-twin, Property {number}: {property_text}**`

### Test Categories

1. **Model Processing Tests**
   - GLTF loading and parsing
   - Panel ID extraction from mesh names
   - Material application and geometry preservation

2. **Status Management Tests**  
   - API data fetching and error handling
   - Status-to-color mapping accuracy
   - Update efficiency and change detection

3. **User Interaction Tests**
   - Panel click detection and ID identification
   - Status panel display and information completeness
   - Navigation and camera controls

4. **Performance Tests**
   - Memory usage during model loading
   - Rendering performance with large models
   - Polling efficiency and resource management

### Integration Testing

- **End-to-End Scenarios**: Complete workflows from model upload to status visualization
- **Cross-Browser Compatibility**: Testing across Chrome, Firefox, Safari, and Edge
- **Device Testing**: Validation on desktop, tablet, and mobile devices
- **Network Condition Testing**: Behavior under slow, intermittent, and failed network conditions