#!/bin/bash

# Setup script for configuring input mode preference
# This fixes the multiline input UX issues

echo "🚀 CLI Input Mode Setup"
echo "======================="
echo ""
echo "Choose your preferred input mode:"
echo ""
echo "1) 📝 Editor Mode (Recommended)"
echo "   - Opens VS Code/nano for input"
echo "   - Perfect for code blocks"
echo "   - Most reliable multiline experience"
echo ""
echo "2) 📄 Terminal Mode (Improved)"
echo "   - Type/paste in terminal"
echo "   - Press Enter twice to finish"
echo "   - Good for quick tasks"
echo ""
echo "3) 📋 Single Line Mode"
echo "   - For simple one-line questions"
echo "   - Fastest for basic queries"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
  1)
    # Set editor mode
    sed -i 's/type: ".*"/type: "editor"/' config.yaml
    echo "✅ Set to Editor Mode"
    echo "   Your default editor will open for input"
    ;;
  2)
    # Set multiline text mode
    sed -i 's/type: ".*"/type: "text"/' config.yaml
    sed -i 's/multiline: .*/multiline: true/' config.yaml
    echo "✅ Set to Terminal Mode"
    echo "   Paste your code and press Enter twice to finish"
    ;;
  3)
    # Set single line mode
    sed -i 's/type: ".*"/type: "input"/' config.yaml
    sed -i 's/multiline: .*/multiline: false/' config.yaml
    echo "✅ Set to Single Line Mode"
    echo "   Perfect for quick questions"
    ;;
  *)
    echo "❌ Invalid choice. No changes made."
    exit 1
    ;;
esac

echo ""
echo "🎉 Setup complete! Run your CLI now with:"
echo "   npm run dev        (single agent)"
echo "   npm run dev:heavy  (multi agent)" 