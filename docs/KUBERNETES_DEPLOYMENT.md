# DropMate Kubernetes Deployment Guide

## 📦 What Was Created

A complete Kubernetes configuration for deploying DropMate as microservices on DigitalOcean.

### File Structure

```
k8s/digitalocean/
├── 00-namespace.yaml          # Kubernetes namespace
├── 01-secrets.yaml            # Secrets template (update with real values)
├── 02-configmaps.yaml         # Application configuration
├── 03-postgres.yaml           # PostgreSQL StatefulSet with persistent storage
├── 04-redis.yaml              # Redis deployment with persistent storage
├── 05-core-api.yaml           # Core API deployment + LoadBalancer + HPA
├── 06-location-service.yaml   # Location service deployment + LoadBalancer + HPA
├── 07-notification-service.yaml # Notification service deployment + LoadBalancer + HPA
├── 08-ingress.yaml            # Ingress configuration with nginx + cert-manager
├── 09-cert-manager.yaml       # Certificate manager for SSL/TLS
├── 10-scaling-monitor-rbac.yaml # RBAC for scaling monitor service
├── 11-scaling-monitor-service.yaml # Scaling monitor service (email alerts)
├── deploy.sh                  # Automated deployment script
├── setup-secrets.sh           # Interactive secrets generator
├── build-and-push.sh          # Docker build and push script
├── README.md                  # Comprehensive deployment guide
└── .gitignore                 # Prevents committing secrets
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean Kubernetes                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Core API    │  │  Location    │  │ Notification │      │
│  │  (8080)      │  │  Service     │  │  Service     │      │
│  │  2-10 pods   │  │  (8081)      │  │  (8082)      │      │
│  │  + HPA       │  │  2-8 pods    │  │  2-6 pods    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         │                  │    ┌─────────────┤               │
│         │                  │    │ Scaling     │               │
│         │                  │    │ Monitor     │               │
│         │                  │    │ (8083)      │               │
│         │                  │    │ 1 pod       │               │
│         │                  │    └─────────────┘               │
│         │                  │    (HPA watcher, email alerts)   │
│         │                  │                  │               │
│  ┌──────┴──────────────────┴──────────────────┴───────┐     │
│  │                    Redis                             │     │
│  │           (Pub/Sub for real-time events)             │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐     │
│  │          PostgreSQL StatefulSet                       │     │
│  │          (10GB Persistent Volume)                     │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           │
                    ┌──────┴──────┐
                    │ NGINX Ingress│ (1x @ $12/mo)
                    │ + SSL/TLS    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Internet   │
                    └─────────────┘
```

## 🚀 Quick Deployment Guide

### Prerequisites

1. **DigitalOcean Account**
2. **Kubernetes Cluster** (3 nodes, s-2vcpu-4gb recommended)
3. **Docker Registry** (DigitalOcean Container Registry recommended)
4. **Tools:** `kubectl`, `doctl`, `docker`

### Deployment Steps

#### 1. Create Kubernetes Cluster

```bash
doctl kubernetes cluster create dropmate-cluster \
  --region nyc1 \
  --version latest \
  --count 3 \
  --size s-2vcpu-4gb
```

#### 2. Connect kubectl

```bash
doctl kubernetes cluster kubeconfig save dropmate-cluster
kubectl cluster-info
```

#### 3. Build Docker Images

```bash
cd k8s/digitalocean
./build-and-push.sh
```

Or manually:
```bash
docker build -t registry.digitalocean.com/your-registry/dropmate-core-api:latest \
  -f services/core-api/Dockerfile services/core-api

docker push registry.digitalocean.com/your-registry/dropmate-core-api:latest

# Repeat for location-service and notification-service
```

#### 4. Configure Secrets

```bash
cd k8s/digitalocean
./setup-secrets.sh
# Follow the interactive prompts
```

#### 5. Update Configurations

**Update image references in:**
- `05-core-api.yaml`
- `06-location-service.yaml`
- `07-notification-service.yaml`

Change:
```yaml
image: your-registry/dropmate-core-api:latest
```

To:
```yaml
image: registry.digitalocean.com/your-registry/dropmate-core-api:latest
```

**Update domains in `08-ingress.yaml`** (if using Ingress)

#### 6. Deploy

```bash
./deploy.sh
```

Or manually:
```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets-generated.yaml
kubectl apply -f 02-configmaps.yaml
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-redis.yaml
kubectl apply -f 05-core-api.yaml
kubectl apply -f 06-location-service.yaml
kubectl apply -f 07-notification-service.yaml
kubectl apply -f 08-ingress.yaml  # Optional
```

#### 7. Verify Deployment

```bash
# Check all resources
kubectl get all -n dropmate

# Get LoadBalancer IPs
kubectl get svc -n dropmate

# Check logs
kubectl logs -f deployment/core-api -n dropmate
```

## 🔧 Key Features

### 1. Auto-Scaling (HPA)
Each service has Horizontal Pod Autoscaling configured:
- **Core API:** 2-10 pods based on CPU/Memory (90% threshold)
- **Location Service:** 2-8 pods
- **Notification Service:** 2-6 pods
- **Scaling Monitor:** Watches HPA events and sends email alerts via SendGrid

### 2. Persistent Storage
- **PostgreSQL:** 10GB DigitalOcean Block Storage
- **Redis:** 5GB DigitalOcean Block Storage
- Data persists across pod restarts

### 3. Health Checks
All services have:
- **Liveness Probes:** Restart unhealthy pods
- **Readiness Probes:** Only route traffic to ready pods

### 4. LoadBalancers
Each service gets a dedicated LoadBalancer with:
- Health checks on `/health` endpoint
- Session affinity for WebSocket (notification service)

### 5. Resource Limits
Defined resource requests and limits prevent resource exhaustion:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

## 💰 Cost Estimate

**DigitalOcean Monthly Costs (Current Setup):**

| Resource | Quantity | Unit Cost | Total |
|----------|----------|-----------|-------|
| Kubernetes Nodes (s-2vcpu-4gb) | 3 | $24/mo | $72 |
| NGINX Ingress LoadBalancer | 1 | $12/mo | $12 |
| Block Storage | 15GB | $0.10/GB | $1.50 |
| Container Registry | 1 | $5/mo | $5 |
| SendGrid (email alerts) | 1 | $0/mo | $0 (free tier) |
| **Total** | | | **~$90.50/month** |

**Cost Optimization:**
- Reduce to 2 nodes for non-prod: **Save $24/mo**
- Use smaller node sizes: **Save ~$20/mo**

## 📊 Monitoring

### View Logs

```bash
# Core API
kubectl logs -f deployment/core-api -n dropmate

# All services
kubectl logs -f -l app=core-api -n dropmate --all-containers
```

### Watch Pods

```bash
kubectl get pods -n dropmate -w
```

### Check Scaling

```bash
kubectl get hpa -n dropmate
```

### Resource Usage

```bash
kubectl top pods -n dropmate
kubectl top nodes
```

## 🔄 Updates & Rollbacks

### Update Image

```bash
kubectl set image deployment/core-api \
  core-api=registry.digitalocean.com/your-registry/dropmate-core-api:v2.0.0 \
  -n dropmate
```

### Monitor Rollout

```bash
kubectl rollout status deployment/core-api -n dropmate
```

### Rollback

```bash
kubectl rollout undo deployment/core-api -n dropmate
```

## 🛡️ Security Features

1. **Secrets Management:** All sensitive data in Kubernetes Secrets
2. **Network Isolation:** Namespace-based isolation
3. **TLS/SSL:** Via Ingress with cert-manager (optional)
4. **Resource Limits:** Prevents resource exhaustion attacks
5. **Health Checks:** Auto-recovery from failures

## 🔗 Service URLs

After deployment, get your service URLs:

```bash
kubectl get svc -n dropmate
```

**URLs will be:**
- Core API: `http://<EXTERNAL-IP>/api`
- Location Service: `http://<EXTERNAL-IP>/api/location`
- Notification Service: `ws://<EXTERNAL-IP>` (WebSocket)

## 📝 Database Management

### Backup

```bash
kubectl exec postgres-0 -n dropmate -- \
  pg_dump -U postgres dropmate > backup.sql
```

### Restore

```bash
kubectl exec -i postgres-0 -n dropmate -- \
  psql -U postgres dropmate < backup.sql
```

### Run Migrations

```bash
POD_NAME=$(kubectl get pods -n dropmate -l app=core-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -n dropmate -- npm run migrate
```

## 🆘 Troubleshooting

### Pods CrashLooping

```bash
# Check logs
kubectl logs <pod-name> -n dropmate

# Describe pod for events
kubectl describe pod <pod-name> -n dropmate
```

### Database Connection Issues

```bash
# Test from core-api pod
kubectl exec -it <core-api-pod> -n dropmate -- sh
nc -zv dropmate-postgres 5432
```

### Image Pull Errors

```bash
# Create registry secret
doctl registry kubernetes-manifest | kubectl apply -f -

# Verify in deployment
kubectl get deployment core-api -n dropmate -o yaml
```

## 🧹 Cleanup

```bash
# Delete all resources
kubectl delete namespace dropmate

# Or delete cluster
doctl kubernetes cluster delete dropmate-cluster
```

## 📚 Additional Files

All configuration files are in: `/k8s/digitalocean/`

- **README.md** - Detailed deployment guide
- **deploy.sh** - Automated deployment
- **setup-secrets.sh** - Interactive secrets setup
- **build-and-push.sh** - Docker image builder

## ✅ What's Production-Ready

- ✅ Auto-scaling based on load
- ✅ Persistent data storage
- ✅ Health checks and auto-recovery
- ✅ Load balancing across pods
- ✅ Resource limits and quotas
- ✅ Secrets management
- ✅ Multi-service architecture
- ✅ Redis for caching and pub/sub
- ✅ WebSocket support with session affinity
- ✅ Rolling updates with zero downtime

## 🎯 Next Steps

1. **Deploy to DigitalOcean**
2. **Configure DNS** to point to LoadBalancer IPs
3. **Setup SSL/TLS** via Ingress + cert-manager
4. **Configure monitoring** (Prometheus/Grafana)
5. **Setup CI/CD** for automated deployments
6. **Configure backups** for database
7. **Implement logging** (ELK stack or similar)

---

**🎉 Your DropMate backend is now ready for production deployment on Kubernetes!**
