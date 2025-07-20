#!/bin/bash

# Make It Heavy TypeScript Setup Script
echo "🚀 Make It Heavy - TypeScript Multi-Agent AI System"
echo "=================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. You have: $(node -v)"
    echo "   Please update Node.js and try again."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install base dependencies"
    exit 1
fi

# Install specific dependencies
echo "📦 Installing AI and tool dependencies..."
npm install @langchain/core @langchain/openai @langchain/community @ai-sdk/openai ai js-yaml cheerio axios mathjs enquirer zod

if [ $? -ne 0 ]; then
    echo "❌ Failed to install AI dependencies"
    exit 1
fi

# Install development dependencies
echo "📦 Installing development dependencies..."
npm install --save-dev typescript ts-node @types/node @types/js-yaml

if [ $? -ne 0 ]; then
    echo "❌ Failed to install development dependencies"
    exit 1
fi

echo ""
echo "✅ All dependencies installed successfully!"
echo ""

# Build the project
echo "🔨 Building TypeScript project..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    echo "   Please check the errors above and fix any issues"
    exit 1
fi

echo "✅ TypeScript compilation successful!"
echo ""

# Check if config.yaml has been updated
if grep -q "your-openrouter-api-key-here" config.yaml; then
    echo "⚠️  IMPORTANT: Update your API key in config.yaml"
    echo "   1. Get a free API key from https://openrouter.ai"
    echo "   2. Replace 'your-openrouter-api-key-here' in config.yaml"
    echo ""
fi

echo "🎉 Setup Complete!"
echo ""
echo "🚀 Quick Start:"
echo "   1. Update config.yaml with your OpenRouter API key"
echo "   2. Run single-agent mode: npm run dev"
echo "   3. Run multi-agent mode: npm run dev:heavy"
echo ""
echo "📚 Documentation:"
echo "   - README.md contains full usage instructions"
echo "   - Type 'help' in any mode for available commands"
echo ""
echo "🔧 Available Scripts:"
echo "   npm run dev        - Single-agent development mode"
echo "   npm run dev:heavy  - Multi-agent development mode"
echo "   npm run build      - Build for production"
echo "   npm start          - Run single-agent production"
echo "   npm start:heavy    - Run multi-agent production"
echo ""
echo "Happy coding! 🎯" 