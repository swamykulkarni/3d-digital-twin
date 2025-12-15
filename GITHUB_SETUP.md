# GitHub Repository Setup for 3D Digital Twin

## Step 1: Initialize Git Repository (if not already done)

```bash
# In your DTwin project root directory
git init
git add .
git commit -m "Initial commit: 3D Digital Twin application with Railway deployment config"
```

## Step 2: Create GitHub Repository

### Via GitHub Web Interface:
1. Go to https://github.com
2. Click "+" → "New repository"
3. Name: `3d-digital-twin`
4. Description: `3D Digital Twin - Panel Status Visualization System`
5. Set to Public
6. Don't initialize with README
7. Click "Create repository"

### Via GitHub CLI (if you have it installed):
```bash
gh repo create 3d-digital-twin --public --description "3D Digital Twin - Panel Status Visualization System"
```

## Step 3: Connect Local Repository to GitHub

After creating the GitHub repository, you'll get commands like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/3d-digital-twin.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 4: Verify Upload

1. Go to your GitHub repository URL
2. Verify all files are uploaded:
   - ✅ frontend/ folder
   - ✅ backend/ folder  
   - ✅ package.json
   - ✅ railway.json
   - ✅ Dockerfile
   - ✅ README.md
   - ✅ DEPLOYMENT.md

## Step 5: Deploy to Railway

Once the repository is on GitHub:
1. Go to railway.app
2. Login with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your `3d-digital-twin` repository
5. Railway will automatically deploy!

## Troubleshooting

### If git is not initialized:
```bash
git init
git add .
git commit -m "Initial commit"
```

### If you get authentication errors:
- Make sure you're logged into GitHub
- Use personal access token if needed
- Or use GitHub Desktop app for easier setup

### If Railway can't see your repo:
- Make sure repository is Public
- Refresh the Railway page
- Check GitHub permissions for Railway app