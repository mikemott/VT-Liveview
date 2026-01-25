#!/bin/bash

# VT-LiveView Setup and Test Script
# Sets up environment and runs local test server

set -e

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  🌦️  VT-LiveView Weather Themes Setup        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION detected${NC}"
    echo "Recommended: Node.js 20+"
fi

echo -e "${GREEN}✅ Node.js $(node -v) found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm -v) found${NC}"
echo ""

# Check for .env file
echo "Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo ""
    echo "Please create .env file with your Protomaps API key"
    exit 1
else
    echo -e "${GREEN}✅ .env file exists (using your existing Protomaps API key)${NC}"
fi
echo ""

# Setup backend .env
echo "Checking backend configuration..."
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env..."
    cat > backend/.env << 'EOF'
# Backend Environment Variables
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# NOAA API User-Agent (required by NOAA ToS)
# ⚠️ WARNING: Update CONTACT_EMAIL with a real email address before making NOAA API requests
CONTACT_EMAIL=test@example.com

# CORS (allows frontend to connect)
ALLOWED_ORIGINS=http://localhost:5173
EOF
    echo -e "${GREEN}✅ Created backend/.env${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Update CONTACT_EMAIL in backend/.env with a real email address before making NOAA API requests${NC}"
else
    echo -e "${GREEN}✅ backend/.env exists${NC}"
fi
echo ""

# Install dependencies
echo "Installing dependencies..."
echo ""

if [ ! -d node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

if [ ! -d backend/node_modules ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  🎉 Setup Complete!                           ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "🚀 Ready to start testing weather themes!"
echo ""
echo "To start the servers, run:"
echo ""
echo -e "${GREEN}  ./test-weather-themes.sh${NC}"
echo ""
echo "Or manually:"
echo ""
echo "  Terminal 1:  cd backend && npm run dev"
echo "  Terminal 2:  npm run dev"
echo "  Browser:     http://localhost:5173"
echo ""
echo "📚 See TESTING-WEATHER-THEMES.md for testing guide"
echo ""
