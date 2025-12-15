# 3D Digital Twin - Railway Deployment Guide

## Overview
This guide covers deploying the 3D Digital Twin application to Railway for public testing.

## Application Structure
- **Frontend**: React + Three.js application with 3D visualization
- **Backend**: Express.js API server serving panel status data
- **Deployment**: Single service deployment with backend serving frontend static files

## Pre-deployment Checklist
- ✅ All tests passing (141/141)
- ✅ Frontend builds successfully
- ✅ Backend serves static files in production
- ✅ API endpoints configured for production
- ✅ Error recovery system implemented
- ✅ Interactive panel functionality working

## Railway Deployment Steps

### 1. Connect Repository to Railway
1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Railway will automatically detect the Node.js application

### 2. Environment Configuration
Set the following environment variables in Railway:
```
NODE_ENV=production
PORT=8888
```

### 3. Build Configuration
Railway will use the `railway.json` configuration:
- Build command: `npm run build`
- Start command: `NODE_ENV=production npm run start:production`

### 4. Domain Setup
Railway will provide a public URL like: `https://your-app-name.up.railway.app`

## Application Features
- **3D Panel Visualization**: Interactive 3D building models
- **Real-time Status**: Color-coded panel status (Installed, Pending, Issue, Not Started)
- **Project Selection**: BuildingA, BuildingB, ResidentialComplex
- **Panel Interaction**: Click panels for detailed information
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Performance Monitoring**: Built-in performance tracking

## API Endpoints
- `GET /api/status?project={projectId}` - Get all panels for a project
- `GET /api/status/{panelId}` - Get detailed panel information  
- `GET /api/health` - Health check endpoint
- `GET /*` - Serves React frontend (production only)

## Testing the Deployment
1. Visit the Railway-provided URL
2. Verify the 3D visualization loads
3. Test project switching (BuildingA, BuildingB, ResidentialComplex)
4. Test panel interaction (click on colored panels)
5. Verify status panel shows correct information
6. Test error recovery (should handle network issues gracefully)

## Troubleshooting
- Check Railway logs for any deployment issues
- Verify all environment variables are set correctly
- Ensure the build completed successfully
- Test API endpoints directly: `{domain}/api/health`

## Notes
- This deployment is separate from any other applications (Refuelling SOP, Safety Observation)
- The application uses mock data for demonstration purposes
- All interactive features are fully functional
- Error messages for ResidentialComplex storage issues have been eliminated