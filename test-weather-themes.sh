#!/bin/bash

# VT-LiveView Weather Themes Testing Script
# This script helps test the new weather-adaptive themes locally

set -e

echo "🌦️  VT-LiveView Weather Themes Test Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please create .env file with:"
    echo "   VITE_PROTOMAPS_API_KEY=your_key_here"
    echo ""
    echo "Get a free key at: https://protomaps.com/api"
    exit 1
fi

# Check if backend .env exists
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cat > backend/.env << 'EOF'
# Backend Environment Variables
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# NOAA API User-Agent (required by NOAA ToS)
CONTACT_EMAIL=test@example.com

# CORS (allows frontend to connect)
ALLOWED_ORIGINS=http://localhost:5173

# Optional: Sentry error tracking
# SENTRY_DSN=
# SENTRY_ENVIRONMENT=development
EOF
    echo "✅ Created backend/.env"
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install frontend dependencies
if [ ! -d node_modules ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "✅ Frontend dependencies already installed"
fi

# Install backend dependencies
if [ ! -d backend/node_modules ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
else
    echo "✅ Backend dependencies already installed"
fi

echo ""
echo "🚀 Starting servers..."
echo ""
echo "Backend will run on: http://localhost:4000"
echo "Frontend will run on: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup EXIT INT TERM

# Start backend in background
echo "Starting backend server..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check backend.log for errors."
    cat backend.log
    exit 1
fi

echo "✅ Backend running (PID: $BACKEND_PID)"

# Start frontend in background
echo "Starting frontend server..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "Waiting for frontend to start..."
sleep 3

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed to start. Check frontend.log for errors."
    cat frontend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Frontend running (PID: $FRONTEND_PID)"
echo ""
echo "=========================================="
echo "🎉 Both servers are running!"
echo "=========================================="
echo ""
echo "📱 Open in browser: http://localhost:5173"
echo ""
echo "🧪 Testing Weather Themes:"
echo "   1. Toggle to light mode (sun/moon icon)"
echo "   2. Check the UI colors - they should match current weather"
echo "   3. Colors will update every 5 minutes as weather changes"
echo ""
echo "🎨 Expected themes based on weather:"
echo "   ☀️  Sunny: Golden yellows (#FDB813)"
echo "   🌧️  Rainy: Steel blues (#4A90E2)"
echo "   ❄️  Snowy: Ice blues (#64B5F6)"
echo "   ⚠️  Severe: Alert reds (#EF5350)"
echo ""
echo "📋 Current weather for Montpelier, VT will determine the theme"
echo ""
echo "Logs:"
echo "   Backend: tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "Press Ctrl+C to stop both servers..."
echo ""

# Keep script running and show logs
tail -f frontend.log backend.log
