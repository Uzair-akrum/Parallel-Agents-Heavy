#!/bin/bash

echo "🔧 Environment Setup for Make It Heavy"
echo "====================================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists."
    read -p "Do you want to overwrite it? (y/N): " overwrite
    case $overwrite in
        [yY]|[yY][eE][sS])
            echo "✅ Overwriting existing .env file..."
            ;;
        *)
            echo "❌ Keeping existing .env file. Exiting."
            exit 0
            ;;
    esac
fi

# Check if environment.example exists
if [ ! -f "environment.example" ]; then
    echo "❌ environment.example file not found!"
    echo "   This file should contain the template for your environment variables."
    exit 1
fi

# Copy the example file to .env
cp environment.example .env

echo "✅ Created .env file from environment.example"
echo ""
echo "🔑 IMPORTANT: Update your API key in .env file"
echo "   1. Open .env in your editor"
echo "   2. Replace the OPENROUTER_API_KEY value with your actual API key"
echo "   3. Get a free API key from https://openrouter.ai"
echo ""
echo "📝 Your configuration will now be loaded from:"
echo "   1. Environment variables (highest priority)"
echo "   2. .env file (medium priority)" 
echo "   3. config.yaml defaults (lowest priority)"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env file: nano .env (or your preferred editor)"
echo "   2. Set your OPENROUTER_API_KEY"
echo "   3. Run the application: npm run dev"
echo ""
echo "💡 Tip: Add .env to your .gitignore to keep your secrets safe!"

# Check if .gitignore exists and add .env if not already there
if [ -f ".gitignore" ]; then
    if ! grep -q "^\.env$" .gitignore; then
        echo ".env" >> .gitignore
        echo "✅ Added .env to .gitignore"
    fi
else
    echo ".env" > .gitignore
    echo "✅ Created .gitignore and added .env"
fi

echo ""
echo "🎉 Environment setup complete!" 