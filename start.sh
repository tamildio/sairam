#!/bin/bash

# Rent Receipt App - Local Development Startup Script

echo "🏠 Starting Rent Receipt App (Local Database Version)"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create data directory if it doesn't exist
mkdir -p server/data

echo "🚀 Starting backend server..."
node server/server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

echo "🌐 Starting frontend client..."
npm run client &
CLIENT_PID=$!

echo ""
echo "✅ App is starting up!"
echo "📊 Backend: http://localhost:3001"
echo "🌐 Frontend: http://localhost:5173"
echo "🔐 Admin Password: admin123"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait

