#!/bin/bash

# 🔍 Argus Setup Script
# This script sets up the development environment for Argus

set -e

echo "👁️ Setting up Argus - The All-Seeing Code Guardian..."

# Check Node.js version
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="22.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        echo "✅ Node.js version $NODE_VERSION is compatible"
    else
        echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 22.0.0 or later"
        exit 1
    fi
else
    echo "❌ Node.js is not installed. Please install Node.js 22.0.0 or later"
    exit 1
fi

# Clean old installations
echo "🧹 Cleaning previous installations..."
npm run clean 2>/dev/null || true
rm -rf node_modules package-lock.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run setup checks
echo "🔧 Running setup validation..."
npm run lint
npm run format:check
npm run build

echo "✅ Argus setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Set up your API keys:"
echo "     export ANTHROPIC_API_KEY='your-key'"
echo "     export OPENAI_API_KEY='your-key'"
echo ""
echo "  2. Run tests:"
echo "     npm test"
echo ""
echo "  3. Start developing:"
echo "     npm run build    # Build the project"
echo "     npm run lint     # Check code quality"
echo "     npm run format   # Format code"
echo ""
echo "👁️ Argus is ready to watch over your code!"