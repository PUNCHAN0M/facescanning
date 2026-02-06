#!/bin/bash

# * ./scripts/linux/start-prod.sh

# React Nest Template Production Setup

echo "🏭 Starting React Nest Template Production Environment"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to project root directory
PROJECT_ROOT="$(dirname "$0")/../.."
cd "$PROJECT_ROOT"

# Check for .env.prod file
if [ ! -f "server/.env.prod" ]; then
    echo "⚠️  Warning: server/.env.prod file not found!"
    echo "   Create server/.env.prod file from template:"
    echo "   cp server/.env.prod.example server/.env.prod"
    echo "   Then edit server/.env.prod with required variables:"
    echo "   NODE_ENV=production"
    echo "   DB_PASSWORD=your_db_password"
    echo "   JWT_SECRET=your_jwt_secret"
    echo "   OPENID_ISSUER=your_oidc_issuer"
    echo "   OPENID_CLIENT_ID=your_client_id"
    echo ""
    exit 1
fi

echo "📦 Starting production containers..."

# Start production environment
docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml up -d

echo "✅ Production environment is starting..."
echo ""
echo "📋 Services:"
echo "  🌐 Client (Next.js):  http://localhost:5173"
echo "  🚀 Server (NestJS):   http://localhost:8000"
echo "  🗄️  Database (PostgreSQL): localhost:5432"
echo ""
echo "🔍 To view logs:"
echo "  docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml logs -f"
echo ""
echo "🛑 To stop:"
echo "  docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml down"
