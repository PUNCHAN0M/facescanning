# 🏭 Production Deployment

## 🎯 Production Setup

```bash
# Setup production environment files
cp server/.env.prod.example server/.env.prod && cp client/.env.prod.example client/.env.prod

# Build production images
pnpm build

# เริ่ม production environment
pnpm prod

# หยุด production environment
pnpm prod:stop
```

## 📋 Production Services

| Service                      | URL                   | Description          |
| ---------------------------- | --------------------- | -------------------- |
| 🌐 **Client (React Router)** | http://localhost:5173 | Frontend Application |
| 🚀 **Server (NestJS)**       | http://localhost:8000 | Backend API Server   |
| 🗄️ **Database (PostgreSQL)** | http://localhost:5432 | Database Server      |

## 📊 Production Logs

```bash
# ดู logs ทุก prod services
docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml logs -f

# ดู logs เฉพาะ service
docker logs react-nest-template-client-prod -f  # Client logs
docker logs react-nest-template-server-prod -f  # Server logs
docker logs react-nest-template-pg-prod -f      # Database logs
```

## 🔄 Production Restart Services

```bash
# Restart ทุก prod services
docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml restart

# Restart เฉพาะ service
docker restart react-nest-template-client-prod  # Client only
docker restart react-nest-template-server-prod  # Server only
docker restart react-nest-template-pg-prod      # Database only
```

## 🔍 Production Container Access

```bash
# เข้าไปใน prod container shell
docker exec -it react-nest-template-client-prod sh  # Client container
docker exec -it react-nest-template-server-prod sh  # Server container

# เชื่อมต่อ prod database
docker exec -it react-nest-template-pg-prod psql -U react-nest-template -d react-nest-template
```

## 🧪 Production Tests

```bash
# รัน prod server tests
docker exec react-nest-template-server-prod pnpm test

# รัน prod client tests
docker exec react-nest-template-client-prod pnpm test
```

## 📊 Production Monitoring

```bash
# ดูสถานะ production containers
docker ps

# Monitor resource usage
docker stats

# ทดสอบ production API
curl http://localhost:8000/api/
```

## 🧹 Production Cleanup

```bash
# Clean up prod containers และ volumes
docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml down -v --remove-orphans
```
