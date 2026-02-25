#!/bin/bash

# * ./scripts/linux/stop-prod.sh

# Stop React Nest Template Production Environment

echo "🛑 Stopping React Nest Template Production Environment"

# Navigate to project root directory
PROJECT_ROOT="$(dirname "$0")/../.."
cd "$PROJECT_ROOT"

# Stop all containers
docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml down

echo "✅ Production environment stopped"
echo ""
echo "🧹 To clean up (remove containers and volumes):"
echo "  docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml down -v --remove-orphans"
