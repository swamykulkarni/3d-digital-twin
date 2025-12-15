# Railway Deployment Instructions for 3D Digital Twin

## Quick Deploy to Railway

### Option 1: One-Click Deploy (Recommended)
1. Click this button to deploy directly to Railway:
   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

### Option 2: Manual Deployment
1. **Fork/Clone Repository**
   - Ensure you have this DTwin repository ready

2. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select the DTwin repository

3. **Configure Environment**
   - Railway will auto-detect the Node.js app
   - Set environment variable: `NODE_ENV=production`
   - Railway will automatically assign a PORT

4. **Deploy**
   - Railway will automatically:
     - Install dependencies (`npm install`)
     - Build frontend (`npm run build`)
     - Start production server (`npm run start:production`)

## Deployment Configuration

### Files Created for Railway:
- `railway.json` - Railway deployment configuration
- `Dockerfile` - Container configuration (optional)
- `.dockerignore` - Optimized build context
- `DEPLOYMENT.md` - Detailed deployment guide

### Build Process:
1. Install root dependencies
2. Install backend dependencies  
3. Install frontend dependencies
4. Build frontend React app
5. Start backend server (serves API + static frontend)

### Production Features:
- ✅ Single service deployment (backend serves frontend)
- ✅ Environment-aware API URLs
- ✅ Static file serving for React app
- ✅ Health check endpoint (`/api/health`)
- ✅ Error recovery and retry logic
- ✅ Performance monitoring
- ✅ Interactive 3D panel visualization

## Expected Deployment URL
Railway will provide a URL like: `https://dtwin-production-xxxx.up.railway.app`

## Testing the Deployed App
1. **Basic Functionality**
   - Visit the Railway URL
   - Verify 3D scene loads with building visualization
   - Test project dropdown (BuildingA, BuildingB, ResidentialComplex)

2. **Interactive Features**
   - Click on colored panels in the 3D scene
   - Verify panel details appear in right sidebar
   - Test hover effects on panels
   - Click outside panels to clear selection

3. **API Endpoints**
   - Test health check: `{domain}/api/health`
   - Test status API: `{domain}/api/status?project=BuildingA`

4. **Error Handling**
   - Switch to ResidentialComplex (should not show storage errors)
   - Verify error recovery works if network issues occur

## Application Architecture
```
Railway Deployment
├── Backend (Express.js on port 8888)
│   ├── API Routes (/api/*)
│   ├── Static File Serving (/)
│   └── Health Check (/api/health)
└── Frontend (React + Three.js)
    ├── Built to /frontend/dist
    └── Served by backend in production
```

## Key Features Deployed
- **3D Visualization**: Interactive building models with Three.js
- **Real-time Status**: Color-coded panel status visualization
- **Project Management**: Multiple building projects
- **Panel Interaction**: Click for detailed panel information
- **Error Recovery**: Automatic retry and fallback systems
- **Performance Monitoring**: Built-in performance tracking
- **Responsive Design**: Works on desktop and mobile

## Notes
- This deployment is completely separate from other applications
- Uses mock data for demonstration (easily replaceable with real APIs)
- All 141 tests passing before deployment
- No storage error messages for ResidentialComplex project
- Optimized for production with proper error handling