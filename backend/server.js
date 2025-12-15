import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8888;

app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
}

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Error logging middleware
const logError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR ${context}:`, error.message);
  console.error('Stack trace:', error.stack);
};

// Mock panel status data - replace with actual database/Azure integration
const mockPanelData = {
  'BuildingA': [
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
      status: 'INSTALLED',
      installDate: '2024-12-09',
      notes: 'Installation completed successfully',
      lastUpdated: '2024-12-09T16:45:00Z'
    },
    { 
      id: 'PNL-05-104', 
      status: 'ISSUE',
      installDate: null,
      notes: 'Damaged panel, replacement ordered',
      lastUpdated: '2024-12-08T11:20:00Z'
    },
    { 
      id: 'PNL-06-101', 
      status: 'INSTALLED',
      installDate: '2024-12-11',
      notes: 'Installation completed successfully',
      lastUpdated: '2024-12-11T10:00:00Z'
    },
    { 
      id: 'PNL-06-102', 
      status: 'PENDING',
      installDate: null,
      notes: 'Scheduled for installation tomorrow',
      lastUpdated: '2024-12-11T08:30:00Z'
    }
  ],
  'BuildingB': [
    { 
      id: 'PNL-01-001', 
      status: 'INSTALLED',
      installDate: '2024-12-05',
      notes: 'First panel installed',
      lastUpdated: '2024-12-05T13:00:00Z'
    },
    { 
      id: 'PNL-01-002', 
      status: 'NOT_STARTED',
      installDate: null,
      notes: 'Waiting for crane availability',
      lastUpdated: '2024-12-01T12:00:00Z'
    }
  ],
  'ResidentialComplex': [
    // Left Tower Complex
    { 
      id: 'RES-L1-001', 
      status: 'INSTALLED',
      installDate: '2024-12-01',
      notes: 'Ground floor facade panel - Left tower',
      lastUpdated: '2024-12-01T10:00:00Z'
    },
    { 
      id: 'RES-L1-002', 
      status: 'INSTALLED',
      installDate: '2024-12-01',
      notes: 'Ground floor facade panel - Left tower',
      lastUpdated: '2024-12-01T10:30:00Z'
    },
    { 
      id: 'RES-L2-001', 
      status: 'INSTALLED',
      installDate: '2024-12-02',
      notes: 'Second floor residential unit - Left tower',
      lastUpdated: '2024-12-02T14:15:00Z'
    },
    { 
      id: 'RES-L2-002', 
      status: 'PENDING',
      installDate: null,
      notes: 'Awaiting balcony completion - Left tower',
      lastUpdated: '2024-12-10T09:00:00Z'
    },
    { 
      id: 'RES-L3-001', 
      status: 'INSTALLED',
      installDate: '2024-12-03',
      notes: 'Third floor residential unit - Left tower',
      lastUpdated: '2024-12-03T11:45:00Z'
    },
    { 
      id: 'RES-L3-002', 
      status: 'ISSUE',
      installDate: null,
      notes: 'Glass panel cracked during installation - Left tower',
      lastUpdated: '2024-12-08T16:20:00Z'
    },
    { 
      id: 'RES-L4-001', 
      status: 'PENDING',
      installDate: null,
      notes: 'Fourth floor unit - awaiting crane - Left tower',
      lastUpdated: '2024-12-11T08:00:00Z'
    },
    { 
      id: 'RES-L5-001', 
      status: 'NOT_STARTED',
      installDate: null,
      notes: 'Penthouse level - Left tower',
      lastUpdated: '2024-12-01T12:00:00Z'
    },
    
    // Right Tower Complex
    { 
      id: 'RES-R1-001', 
      status: 'INSTALLED',
      installDate: '2024-11-28',
      notes: 'Ground floor facade panel - Right tower',
      lastUpdated: '2024-11-28T15:30:00Z'
    },
    { 
      id: 'RES-R1-002', 
      status: 'INSTALLED',
      installDate: '2024-11-28',
      notes: 'Ground floor facade panel - Right tower',
      lastUpdated: '2024-11-28T16:00:00Z'
    },
    { 
      id: 'RES-R1-003', 
      status: 'INSTALLED',
      installDate: '2024-11-29',
      notes: 'Ground floor corner unit - Right tower',
      lastUpdated: '2024-11-29T10:15:00Z'
    },
    { 
      id: 'RES-R2-001', 
      status: 'INSTALLED',
      installDate: '2024-11-30',
      notes: 'Second floor residential unit - Right tower',
      lastUpdated: '2024-11-30T13:45:00Z'
    },
    { 
      id: 'RES-R2-002', 
      status: 'INSTALLED',
      installDate: '2024-12-01',
      notes: 'Second floor residential unit - Right tower',
      lastUpdated: '2024-12-01T09:30:00Z'
    },
    { 
      id: 'RES-R2-003', 
      status: 'PENDING',
      installDate: null,
      notes: 'Second floor corner unit - Right tower',
      lastUpdated: '2024-12-09T14:00:00Z'
    },
    { 
      id: 'RES-R3-001', 
      status: 'INSTALLED',
      installDate: '2024-12-04',
      notes: 'Third floor residential unit - Right tower',
      lastUpdated: '2024-12-04T11:20:00Z'
    },
    { 
      id: 'RES-R3-002', 
      status: 'INSTALLED',
      installDate: '2024-12-05',
      notes: 'Third floor residential unit - Right tower',
      lastUpdated: '2024-12-05T15:10:00Z'
    },
    { 
      id: 'RES-R4-001', 
      status: 'PENDING',
      installDate: null,
      notes: 'Fourth floor unit - materials delayed - Right tower',
      lastUpdated: '2024-12-10T10:30:00Z'
    },
    { 
      id: 'RES-R4-002', 
      status: 'ISSUE',
      installDate: null,
      notes: 'Fourth floor unit - structural review needed - Right tower',
      lastUpdated: '2024-12-07T13:45:00Z'
    },
    { 
      id: 'RES-R5-001', 
      status: 'NOT_STARTED',
      installDate: null,
      notes: 'Fifth floor unit - Right tower',
      lastUpdated: '2024-12-01T12:00:00Z'
    },
    { 
      id: 'RES-R6-001', 
      status: 'NOT_STARTED',
      installDate: null,
      notes: 'Penthouse level - Right tower',
      lastUpdated: '2024-12-01T12:00:00Z'
    },
    
    // Central Bridge/Plaza Elements
    { 
      id: 'RES-C1-001', 
      status: 'INSTALLED',
      installDate: '2024-11-25',
      notes: 'Central plaza flooring panel',
      lastUpdated: '2024-11-25T14:00:00Z'
    },
    { 
      id: 'RES-C2-001', 
      status: 'INSTALLED',
      installDate: '2024-12-06',
      notes: 'Bridge connection panel',
      lastUpdated: '2024-12-06T16:30:00Z'
    }
  ]
};

// Create a flat lookup for individual panel access
const createPanelLookup = () => {
  const lookup = {};
  Object.values(mockPanelData).forEach(projectPanels => {
    projectPanels.forEach(panel => {
      lookup[panel.id] = panel;
    });
  });
  return lookup;
};

const panelLookup = createPanelLookup();

// API endpoint to get all panel status for a project
app.get('/api/status', (req, res) => {
  try {
    const { project } = req.query;
    
    if (!project) {
      const error = new Error('Project parameter is required');
      logError(error, 'GET /api/status');
      return res.status(400).json({ 
        error: 'Project parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const panels = mockPanelData[project];
    
    if (!panels) {
      const error = new Error(`Project '${project}' not found`);
      logError(error, 'GET /api/status');
      return res.status(404).json({ 
        error: `Project '${project}' not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[${new Date().toISOString()}] Successfully retrieved ${panels.length} panels for project '${project}'`);
    
    res.json({
      project: project,
      panels: panels,
      count: panels.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logError(error, 'GET /api/status');
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to get detailed status for a specific panel
app.get('/api/status/:panelId', (req, res) => {
  try {
    const { panelId } = req.params;
    
    if (!panelId) {
      const error = new Error('Panel ID parameter is required');
      logError(error, 'GET /api/status/:panelId');
      return res.status(400).json({ 
        error: 'Panel ID parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const panel = panelLookup[panelId];
    
    if (!panel) {
      const error = new Error(`Panel '${panelId}' not found`);
      logError(error, 'GET /api/status/:panelId');
      return res.status(404).json({ 
        error: `Panel '${panelId}' not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[${new Date().toISOString()}] Successfully retrieved panel details for '${panelId}'`);
    
    res.json({
      panel: panel,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logError(error, 'GET /api/status/:panelId');
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  } catch (error) {
    logError(error, 'GET /api/health');
    res.status(500).json({ 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handling middleware
app.use((error, req, res, next) => {
  logError(error, `${req.method} ${req.url}`);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const frontendPath = path.join(__dirname, '../frontend/dist');
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // Handle 404 for undefined routes in development
  app.use('*', (req, res) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    logError(error, '404 Handler');
    
    res.status(404).json({
      error: 'Route not found',
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  });
}

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
  console.log(`[${new Date().toISOString()}] Available endpoints:`);
  console.log(`  GET /api/status?project={projectId} - Get all panels for a project`);
  console.log(`  GET /api/status/{panelId} - Get detailed panel information`);
  console.log(`  GET /api/health - Health check`);
});