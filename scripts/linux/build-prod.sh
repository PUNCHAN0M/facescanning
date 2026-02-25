#!/bin/bash

# * ./scripts/linux/build-prod.sh

# Production Build and Deploy Script

echo "🏭 Building React Nest Template for Production"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to project root
PROJECT_ROOT="$(dirname "$0")/../.."
cd "$PROJECT_ROOT"

echo "📦 Building production images..."

# Build client production image
echo "🔨 Building client..."
docker build -f client/Dockerfile.prod -t react-nest-template-client:latest ./client

# Build server production image
echo "🔨 Building server..."
docker build -f server/Dockerfile.prod -t react-nest-template-server:latest ./server

echo "✅ Production images built successfully!"
echo ""
echo "🚀 To run production environment:"
echo "  docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml up -d"
echo ""
echo "📋 Production Services:"
echo "  🌐 Client: http://localhost:5173"
echo "  🚀 Server: http://localhost:8000"
echo "  🗄️  Database: localhost:5432"
