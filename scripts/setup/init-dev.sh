#!/bin/bash

set -e

echo "🚀 Initializing Project-0 Development Environment..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Please install Node.js 20+"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not found. Installing..."; npm install -g pnpm; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not found. Please install Docker Desktop"; exit 1; }
command -v ollama >/dev/null 2>&1 || { echo "❌ Ollama not found. Installing..."; brew install ollama; }

echo "✅ All prerequisites installed"

# Setup environment
echo "📝 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please update .env file with your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
pnpm prepare

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
pnpm db:migrate

# Seed database (development only)
if [ "$NODE_ENV" != "production" ]; then
    echo "🌱 Seeding database..."
    pnpm db:seed
fi

# Pull Ollama model
echo "🤖 Pulling Ollama model (this may take a while)..."
ollama pull mistral:7b-instruct-q4_K_M

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs uploads/pdfs

# Set permissions
chmod +x scripts/**/*.sh || true

echo "✅ Development environment initialized successfully!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Run 'pnpm dev' to start development servers"
echo "3. Visit http://localhost:5173 for frontend"
echo "4. Visit http://localhost:3000/api/health for backend"
