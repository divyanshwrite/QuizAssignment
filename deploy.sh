#!/bin/bash

echo "🚀 Starting deployment process..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Committing latest changes..."
    git add .
    git commit -m "Pre-deployment commit - $(date)"
fi

echo "✅ Code is ready for deployment!"
echo ""
echo "🎯 Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Connect to Render.com and deploy using render.yaml"
echo "3. Update frontend environment with backend URL"
echo ""
echo "🔗 Frontend is already deployed at: https://quiz-app-ten-phi-14.vercel.app"
