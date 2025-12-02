#!/bin/bash

# ClickUp MCP Server Setup Script
# This script helps set up the project and provides configuration for Cursor MCP

set -e

echo "🚀 ClickUp MCP Server Setup"
echo "============================"
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js v18 or higher is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Build the project
echo "🔨 Building TypeScript project..."
npm run build
echo "✅ Build complete"
echo ""

# Check if build was successful
if [ ! -f "build/index.js" ]; then
    echo "❌ Error: Build failed - build/index.js not found"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your ClickUp API key from: https://app.clickup.com/settings/apps"
echo "2. Get your Team ID from your ClickUp workspace URL"
echo "3. Add the server to Cursor MCP configuration (see SETUP_GUIDE.md)"
echo ""
echo "🧪 Test the server locally:"
echo "   CLICKUP_API_KEY=your-key CLICKUP_TEAM_ID=your-team npm start"
echo ""

BUILD_PATH="$(pwd)/build/index.js"
echo "📍 Build path (for Cursor MCP config):"
echo "   $BUILD_PATH"

