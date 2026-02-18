# Production Deployment Guide

## 🚀 สำหรับ 10-100 Concurrent Users

### 1. Architecture

```
[Clients] → [Load Balancer: Nginx] → [Multiple FastAPI Workers] → [GPU Pool]
                                              ↓
                                      [Redis Cache: Vector DB]
                                              ↓
                                      [FAISS Vector Store]
```

### 2. Server Configuration

#### Run with Multiple Workers (Gunicorn + Uvicorn)
```bash
pip install gunicorn

# 4 workers = (2 × CPU cores) + 1
gunicorn app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
```

#### Using Docker (Recommended)
```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "app:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  face-api:
    build: ./server
    ports:
      - "8000:8000"
    volumes:
      - ./server/data:/app/data
      - ./server/models:/app/models
    environment:
      - WORKERS=4
    deploy:
      replicas: 2  # Multiple instances
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - face-api
```

### 3. Nginx Load Balancer

```nginx
# nginx.conf
upstream face_api {
    least_conn;  # Load balancing algorithm
    server face-api-1:8000;
    server face-api-2:8000;
}

server {
    listen 80;
    client_max_body_size 10M;

    location / {
        proxy_pass http://face_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 4. Performance Optimizations

#### A. Pre-warm Vector Databases
✅ Already implemented - all organizes loaded on startup

#### B. Rate Limiting
✅ Already implemented - 10 requests/minute per IP

#### C. Connection Pooling (Add if using database)
```python
# For PostgreSQL/MySQL
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40
)
```

#### D. Redis Cache for Results (Optional)
```bash
pip install redis aioredis
```

```python
import redis.asyncio as redis

redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)

# Cache detection results for 60s
await redis_client.setex(f"face:{image_hash}", 60, json.dumps(result))
```

### 5. Client Optimizations

#### Current Settings:
- ✅ DETECT_INTERVAL: 500ms (~2 FPS)
- ✅ Image compression: 80% quality
- ✅ Upload lock: prevents queue buildup
- ✅ Selected organize sent with request

#### Recommended Additional Changes:
```javascript
// A. Resize image before upload (reduce payload)
const MAX_DIMENSION = 640;
if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
  const scale = MAX_DIMENSION / Math.max(w, h);
  c.width = w * scale;
  c.height = h * scale;
  ctx.drawImage(v, expandedX1, expandedY1, w, h, 0, 0, c.width, c.height);
}

// B. Skip upload if face too small/blurry
const MIN_FACE_SIZE = 80; // pixels
if (height < MIN_FACE_SIZE) {
  console.log('Face too small, skipping upload');
  return;
}
```

### 6. Monitoring & Logging

#### Install Dependencies
```bash
pip install prometheus-fastapi-instrumentator sentry-sdk
```

#### Add to app.py
```python
from prometheus_fastapi_instrumentator import Instrumentator
import sentry_sdk

# Sentry for error tracking
sentry_sdk.init(dsn="YOUR_SENTRY_DSN")

# Prometheus metrics
Instrumentator().instrument(app).expose(app)
```

### 7. Database Scaling

#### Current: File-based (FAISS + NPY)
✅ Good for < 100 users
❌ Bottleneck for > 100 users

#### Recommended: Milvus/Qdrant (Vector Database)
```python
# Example with Milvus
from pymilvus import connections, Collection

connections.connect("default", host="localhost", port="19530")
collection = Collection("faces")

# Search
results = collection.search(
    data=[embedding],
    anns_field="embedding",
    param={"metric_type": "IP", "params": {"nprobe": 10}},
    limit=1
)
```

### 8. Kubernetes Deployment (For 100+ Users)

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: face-recognition-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: face-api
  template:
    metadata:
      labels:
        app: face-api
    spec:
      containers:
      - name: api
        image: your-registry/face-api:latest
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "4Gi"
            cpu: "2"
        env:
        - name: WORKERS
          value: "4"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: face-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: face-recognition-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 9. Cost Optimization

#### A. GPU Optimization
- Use GPU batching (process multiple faces at once)
- Consider CPU-only for inference if acceptable latency
- Use smaller models (e.g., MobileFaceNet instead of ArcFace)

#### B. Auto-scaling
- Scale down during low traffic hours
- Use spot instances for dev/staging

#### C. CDN
- Serve static assets (ONNX models) from CDN
- Cache API responses at edge (CloudFlare, AWS CloudFront)

### 10. Performance Benchmarks

| Users | Setup | Latency | Cost/month |
|-------|-------|---------|------------|
| 10    | 1 worker, CPU | ~500ms | $50 |
| 50    | 4 workers, 1 GPU | ~300ms | $200 |
| 100   | 8 workers, 2 GPUs + Load Balancer | ~250ms | $500 |

### 11. Installation Commands

```bash
# Install new dependencies
cd server
pip install slowapi gunicorn

# Test with multiple workers
gunicorn app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000

# Or with Docker
docker-compose up --scale face-api=2
```

### 12. Health Checks

Add to app.py:
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "organizes_loaded": len(vector_db_cache),
        "model_loaded": embedder is not None
    }
```

### 13. Security

- ✅ CORS configured
- ✅ Rate limiting enabled
- ⚠️ Add: API key authentication
- ⚠️ Add: HTTPS/TLS certificates
- ⚠️ Add: Input validation and sanitization
- ⚠️ Add: Request size limits

---

## 🎯 Quick Start for Production

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Pre-build all vector databases
python vector_data.py idol --embed
python vector_data.py psu --embed
python vector_data.py pupa --embed

# 3. Run with production settings
gunicorn app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log
```

## 📊 Monitoring Dashboard

Monitor these metrics:
- Request rate (req/s)
- Response latency (p50, p95, p99)
- Error rate (%)
- GPU utilization (%)
- Memory usage (GB)
- Cache hit rate (%)

Use: Grafana + Prometheus or Datadog
