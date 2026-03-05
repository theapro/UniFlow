#!/bin/bash

echo "========================================"
echo "UniFlow AI Chat - Setup Script"
echo "========================================"
echo ""

echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo "Node.js is installed: $(node --version)"
echo ""

echo "[2/4] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies!"
    exit 1
fi
echo "Dependencies installed successfully!"
echo ""

echo "[3/4] Checking environment configuration..."
if [ ! -f .env ]; then
    echo "WARNING: .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Please edit .env and add your GROQ_API_KEY!"
    echo "Get your API key from: https://console.groq.com/keys"
    echo ""
    read -p "Press enter to continue..."
else
    echo ".env file exists!"
fi
echo ""

echo "[4/4] Setup complete!"
echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Make sure your GROQ_API_KEY is set in .env"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3002"
echo ""
echo "For more information:"
echo "- Quick Start: QUICKSTART.md"
echo "- Full Documentation: README.md"
echo "- Optional Features: ENHANCEMENTS.md"
echo "========================================"
echo ""
