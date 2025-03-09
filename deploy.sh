#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process for When Pigs Fly..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Deploy to Netlify
echo "🌐 Deploying to Netlify..."
if [ "$1" == "--prod" ]; then
  echo "🚨 PRODUCTION DEPLOYMENT 🚨"
  npm run netlify:deploy:prod
else
  echo "📝 Draft deployment (use --prod flag for production)"
  npm run netlify:deploy
fi

echo "✅ Deployment process completed!" 