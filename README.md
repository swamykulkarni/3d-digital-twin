# 3D Digital Twin - Panel Status Visualization

A comprehensive 3D visualization system for tracking construction panel installation status across multiple building projects.

## 🚀 Live Demo
[View Live Application](https://your-railway-url.up.railway.app) *(Deploy to Railway to get your URL)*

## ✨ Features

### 3D Visualization
- **Interactive 3D Models**: Navigate around building structures with mouse/touch controls
- **Real-time Status Colors**: Panels change color based on installation status
  - 🟢 **Green**: Installed
  - 🟡 **Yellow**: Pending
  - 🔴 **Red**: Issues
  - ⚫ **Gray**: Not Started

### Project Management
- **Multiple Buildings**: Switch between BuildingA, BuildingB, and ResidentialComplex
- **Procedural Generation**: ResidentialComplex uses algorithmic building generation
- **GLTF Model Support**: Load external 3D models for BuildingA/BuildingB

### Interactive Features
- **Panel Selection**: Click any panel to view detailed information
- **Hover Effects**: Panels highlight when you hover over them
- **Status Dashboard**: Real-time summary of all panel statuses
- **Detailed Panel Info**: Installation dates, notes, and status history

### Reliability & Performance
- **Error Recovery**: Automatic retry logic for network issues
- **Performance Monitoring**: Built-in FPS and memory tracking
- **Fallback Systems**: Graceful degradation when services are unavailable
- **Responsive Design**: Works on desktop, tablet, and mobile

## 🏗️ Architecture

### Frontend (React + Three.js)
- **React 18**: Modern React with hooks and concurrent features
- **Three.js**: 3D graphics and WebGL rendering
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers and components
- **TypeScript**: Type-safe development

### Backend (Node.js + Express)
- **Express.js**: RESTful API server
- **CORS**: Cross-origin resource sharing
- **Mock Data**: Realistic panel status data for demonstration
- **Health Checks**: Monitoring and diagnostics endpoints

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start:production
```

## 📡 API Endpoints

- `GET /api/status?project={projectId}` - Get all panels for a project
- `GET /api/status/{panelId}` - Get detailed panel information
- `GET /api/health` - Health check and system status

## 🎮 How to Use

1. **Select a Project**: Use the dropdown to switch between buildings
2. **Navigate the 3D Scene**: 
   - Mouse: Click and drag to rotate, scroll to zoom
   - Touch: Pinch to zoom, drag to rotate
3. **Interact with Panels**: Click on colored panels to see details
4. **Monitor Status**: Check the dashboard for overall project progress

## 🏢 Project Types

### BuildingA & BuildingB
- Traditional construction projects
- External GLTF model support
- Azure Storage integration for 3D models

### ResidentialComplex
- Procedurally generated multi-tower complex
- Algorithmic building generation
- No external model dependencies

## 🔧 Configuration

### Environment Variables
- `NODE_ENV`: Set to 'production' for deployment
- `PORT`: Server port (default: 8888)

### Azure Storage (Optional)
Configure in `frontend/src/config/azureConfig.ts` for external 3D models.

## 🧪 Testing

```bash
# Run all tests
npm test

# Frontend tests only
cd frontend && npm test

# Backend tests only  
cd backend && npm test
```

**Test Coverage**: 141/141 tests passing ✅

## 📦 Deployment

### Railway (Recommended)
1. Connect your GitHub repository to Railway
2. Set `NODE_ENV=production` environment variable
3. Deploy automatically with the included `railway.json` configuration

### Docker
```bash
docker build -t 3d-digital-twin .
docker run -p 8888:8888 -e NODE_ENV=production 3d-digital-twin
```

## 🛠️ Technology Stack

- **Frontend**: React, Three.js, TypeScript, Vite
- **Backend**: Node.js, Express.js, ES Modules
- **Testing**: Vitest, Testing Library, Fast-Check (Property-based testing)
- **Deployment**: Railway, Docker
- **3D Graphics**: WebGL, Three.js, React Three Fiber

## 📈 Performance

- **Optimized Rendering**: Efficient Three.js scene management
- **Resource Management**: Automatic cleanup of 3D resources
- **Progressive Loading**: Lazy loading of 3D models
- **Performance Monitoring**: Real-time FPS and memory tracking

## 🔒 Error Handling

- **Network Resilience**: Automatic retry with exponential backoff
- **Graceful Degradation**: Fallback to simplified views when needed
- **User Feedback**: Clear error messages and recovery status
- **Health Monitoring**: Continuous system health checks

## 📄 License

This project is for demonstration purposes. See deployment documentation for production use guidelines.

---

**Built with ❤️ for modern construction project management**