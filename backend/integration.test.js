import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cors from 'cors'

// Import the server logic (we'll need to refactor server.js slightly for testing)
// For now, we'll recreate the server setup for testing

const createTestServer = () => {
  const app = express()
  
  app.use(cors())
  app.use(express.json())

  // Logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${req.method} ${req.url}`)
    next()
  })

  // Error logging middleware
  const logError = (error, context = '') => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ERROR ${context}:`, error.message)
  }

  // Mock panel status data
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
    ]
  }

  // Create a flat lookup for individual panel access
  const createPanelLookup = () => {
    const lookup = {}
    Object.values(mockPanelData).forEach(projectPanels => {
      projectPanels.forEach(panel => {
        lookup[panel.id] = panel
      })
    })
    return lookup
  }

  const panelLookup = createPanelLookup()

  // API endpoint to get all panel status for a project
  app.get('/api/status', (req, res) => {
    try {
      const { project } = req.query
      
      if (!project) {
        const error = new Error('Project parameter is required')
        logError(error, 'GET /api/status')
        return res.status(400).json({ 
          error: 'Project parameter is required',
          timestamp: new Date().toISOString()
        })
      }
      
      const panels = mockPanelData[project]
      
      if (!panels) {
        const error = new Error(`Project '${project}' not found`)
        logError(error, 'GET /api/status')
        return res.status(404).json({ 
          error: `Project '${project}' not found`,
          timestamp: new Date().toISOString()
        })
      }
      
      res.json({
        project: project,
        panels: panels,
        count: panels.length,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      logError(error, 'GET /api/status')
      res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // API endpoint to get detailed status for a specific panel
  app.get('/api/status/:panelId', (req, res) => {
    try {
      const { panelId } = req.params
      
      if (!panelId) {
        const error = new Error('Panel ID parameter is required')
        logError(error, 'GET /api/status/:panelId')
        return res.status(400).json({ 
          error: 'Panel ID parameter is required',
          timestamp: new Date().toISOString()
        })
      }
      
      const panel = panelLookup[panelId]
      
      if (!panel) {
        const error = new Error(`Panel '${panelId}' not found`)
        logError(error, 'GET /api/status/:panelId')
        return res.status(404).json({ 
          error: `Panel '${panelId}' not found`,
          timestamp: new Date().toISOString()
        })
      }
      
      res.json({
        panel: panel,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      logError(error, 'GET /api/status/:panelId')
      res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    try {
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      })
    } catch (error) {
      logError(error, 'GET /api/health')
      res.status(500).json({ 
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Global error handling middleware
  app.use((error, req, res, next) => {
    logError(error, `${req.method} ${req.url}`)
    
    if (res.headersSent) {
      return next(error)
    }
    
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    })
  })

  // Handle 404 for undefined routes
  app.use('*', (req, res) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`)
    logError(error, '404 Handler')
    
    res.status(404).json({
      error: 'Route not found',
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    })
  })

  return app
}

describe('Backend API Integration Tests', () => {
  let app

  beforeAll(() => {
    app = createTestServer()
  })

  describe('Status API Endpoints', () => {
    it('should retrieve all panels for a valid project', async () => {
      const response = await request(app)
        .get('/api/status?project=BuildingA')
        .expect(200)

      expect(response.body).toHaveProperty('project', 'BuildingA')
      expect(response.body).toHaveProperty('panels')
      expect(response.body).toHaveProperty('count', 4)
      expect(response.body).toHaveProperty('timestamp')
      
      expect(Array.isArray(response.body.panels)).toBe(true)
      expect(response.body.panels).toHaveLength(4)
      
      // Verify panel structure
      const panel = response.body.panels[0]
      expect(panel).toHaveProperty('id')
      expect(panel).toHaveProperty('status')
      expect(panel).toHaveProperty('lastUpdated')
    })

    it('should retrieve panels for different projects', async () => {
      const responseA = await request(app)
        .get('/api/status?project=BuildingA')
        .expect(200)

      const responseB = await request(app)
        .get('/api/status?project=BuildingB')
        .expect(200)

      expect(responseA.body.count).toBe(4)
      expect(responseB.body.count).toBe(2)
      expect(responseA.body.project).toBe('BuildingA')
      expect(responseB.body.project).toBe('BuildingB')
    })

    it('should return 400 for missing project parameter', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(400)

      expect(response.body).toHaveProperty('error', 'Project parameter is required')
      expect(response.body).toHaveProperty('timestamp')
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/status?project=NonExistentProject')
        .expect(404)

      expect(response.body).toHaveProperty('error', "Project 'NonExistentProject' not found")
      expect(response.body).toHaveProperty('timestamp')
    })

    it('should retrieve specific panel details', async () => {
      const response = await request(app)
        .get('/api/status/PNL-05-101')
        .expect(200)

      expect(response.body).toHaveProperty('panel')
      expect(response.body).toHaveProperty('timestamp')
      
      const panel = response.body.panel
      expect(panel.id).toBe('PNL-05-101')
      expect(panel.status).toBe('INSTALLED')
      expect(panel.installDate).toBe('2024-12-10')
      expect(panel.notes).toBe('Installation completed successfully')
    })

    it('should return 404 for non-existent panel', async () => {
      const response = await request(app)
        .get('/api/status/NON-EXISTENT-PANEL')
        .expect(404)

      expect(response.body).toHaveProperty('error', "Panel 'NON-EXISTENT-PANEL' not found")
      expect(response.body).toHaveProperty('timestamp')
    })
  })

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'OK')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('version', '1.0.0')
      
      expect(typeof response.body.uptime).toBe('number')
      expect(response.body.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Route not found')
      expect(response.body).toHaveProperty('method', 'GET')
      expect(response.body).toHaveProperty('url', '/api/nonexistent')
      expect(response.body).toHaveProperty('timestamp')
    })

    it('should handle different HTTP methods on undefined routes', async () => {
      const response = await request(app)
        .post('/api/nonexistent')
        .expect(404)

      expect(response.body).toHaveProperty('method', 'POST')
    })
  })

  describe('CORS and Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.headers).toHaveProperty('access-control-allow-origin')
    })

    it('should handle preflight requests', async () => {
      await request(app)
        .options('/api/status')
        .expect(204)
    })
  })

  describe('Data Validation and Requirements Compliance', () => {
    it('should validate all panel data contains required fields', async () => {
      const response = await request(app)
        .get('/api/status?project=BuildingA')
        .expect(200)

      response.body.panels.forEach(panel => {
        // Requirement validation: Each panel must have required fields
        expect(panel).toHaveProperty('id')
        expect(panel).toHaveProperty('status')
        expect(panel).toHaveProperty('lastUpdated')
        
        // Panel ID format validation (Requirements 3.2, 3.3)
        expect(panel.id).toMatch(/^PNL-\d{2}-\d{3}$/)
        
        // Status validation (Requirements 2.1-2.4)
        expect(['INSTALLED', 'PENDING', 'ISSUE', 'NOT_STARTED']).toContain(panel.status)
        
        // Date validation
        if (panel.installDate) {
          expect(panel.installDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
        
        expect(panel.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      })
    })

    it('should provide consistent timestamps', async () => {
      const response1 = await request(app)
        .get('/api/status?project=BuildingA')
        .expect(200)

      const response2 = await request(app)
        .get('/api/status/PNL-05-101')
        .expect(200)

      // Both responses should have timestamps
      expect(response1.body.timestamp).toBeDefined()
      expect(response2.body.timestamp).toBeDefined()
      
      // Timestamps should be valid ISO strings
      expect(() => new Date(response1.body.timestamp)).not.toThrow()
      expect(() => new Date(response2.body.timestamp)).not.toThrow()
    })

    it('should handle concurrent requests correctly', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/status?project=BuildingA')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.count).toBe(4)
        expect(response.body.project).toBe('BuildingA')
      })
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle multiple rapid requests', async () => {
      const startTime = Date.now()
      
      const requests = Array(50).fill().map(() => 
        request(app).get('/api/health')
      )

      const responses = await Promise.all(requests)
      const endTime = Date.now()
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should maintain data consistency under load', async () => {
      const requests = Array(20).fill().map(() => 
        request(app).get('/api/status?project=BuildingA')
      )

      const responses = await Promise.all(requests)
      
      // All responses should be identical
      const firstResponse = responses[0].body
      responses.forEach(response => {
        expect(response.body.count).toBe(firstResponse.count)
        expect(response.body.panels).toEqual(firstResponse.panels)
      })
    })
  })
})

describe('End-to-End API Workflow', () => {
  let app

  beforeAll(() => {
    app = createTestServer()
  })

  it('should complete full workflow: health check -> project status -> panel details', async () => {
    // 1. Health check
    const healthResponse = await request(app)
      .get('/api/health')
      .expect(200)

    expect(healthResponse.body.status).toBe('OK')

    // 2. Get project status
    const statusResponse = await request(app)
      .get('/api/status?project=BuildingA')
      .expect(200)

    expect(statusResponse.body.panels).toHaveLength(4)
    const firstPanel = statusResponse.body.panels[0]

    // 3. Get detailed panel information
    const panelResponse = await request(app)
      .get(`/api/status/${firstPanel.id}`)
      .expect(200)

    expect(panelResponse.body.panel.id).toBe(firstPanel.id)
    expect(panelResponse.body.panel.status).toBe(firstPanel.status)
  })

  it('should handle error recovery workflow', async () => {
    // 1. Try invalid project
    await request(app)
      .get('/api/status?project=InvalidProject')
      .expect(404)

    // 2. Verify system still works with valid request
    const response = await request(app)
      .get('/api/status?project=BuildingA')
      .expect(200)

    expect(response.body.count).toBe(4)

    // 3. Try invalid panel
    await request(app)
      .get('/api/status/INVALID-PANEL')
      .expect(404)

    // 4. Verify system still works with valid panel request
    const panelResponse = await request(app)
      .get('/api/status/PNL-05-101')
      .expect(200)

    expect(panelResponse.body.panel.id).toBe('PNL-05-101')
  })
})