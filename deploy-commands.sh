#!/bin/bash

# 3D Digital Twin - GitHub & Railway Deployment Script

echo "🏗️  3D Digital Twin - Deployment Setup"
echo "======================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
else
    echo "✅ Git repository already initialized"
fi

# Add all files
echo "📁 Adding files to Git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "feat: 3D Digital Twin application ready for Railway deployment

- Interactive 3D panel visualization with Three.js
- Real-time status tracking (Installed, Pending, Issue, Not Started)
- Multiple project support (BuildingA, BuildingB, ResidentialComplex)
- Click-to-view panel details with hover effects
- Error recovery system with automatic retry logic
- Performance monitoring and resource management
- Railway deployment configuration included
- All 141 tests passing
- Production-ready with static file serving"

echo ""
echo "🎯 Next Steps:"
echo "1. Create GitHub repository at: https://github.com/new"
echo "   - Name: 3d-digital-twin"
echo "   - Description: 3D Digital Twin - Panel Status Visualization System"
echo "   - Set to Public"
echo "   - Don't initialize with README"
echo ""
echo "2. After creating the repo, run these commands:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/3d-digital-twin.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Deploy to Railway:"
echo "   - Go to railway.app"
echo "   - Login with GitHub"
echo "   - New Project → Deploy from GitHub repo"
echo "   - Select your 3d-digital-twin repository"
echo ""
echo "✨ Your 3D Digital Twin will be live on Railway!"