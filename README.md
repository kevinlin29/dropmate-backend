# DropMate Backend

Cloud-native delivery tracking platform built with microservices architecture on Kubernetes (DigitalOcean).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm start
```

## 📁 Project Structure

```
dropmate-backend/
├── docs/                       # All documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── KUBERNETES_DEPLOYMENT.md # K8s deployment guide
│   ├── API_DOCUMENTATION.md    # API reference
│   └── ...
├── k8s/                        # Kubernetes manifests
│   └── digitalocean/           # DigitalOcean K8s configs
├── services/                   # Microservices
│   ├── core-api/               # REST API + WebSocket
│   ├── location-service/       # GPS tracking
│   ├── notification-service/   # Real-time notifications
│   └── scaling-monitor-service/ # HPA monitoring & alerts
├── scripts/                    # Utility scripts
│   ├── get-test-token.js       # Generate test auth tokens
│   ├── reset-driver-password.js # Reset driver passwords
│   └── test-shipment-flow.js   # Test shipment workflows
├── scale-up.sh                 # Scale services up (4 replicas)
├── scale-down.sh               # Scale services down (1 replica)
├── start-dashboard.sh          # Start Kubernetes dashboard
├── docker-compose.yml          # Local development setup
└── Dockerfile                  # Docker image configuration
```

## 🏗️ Architecture

**Microservices:**
- **Core API** (8080): REST APIs, authentication, shipment management
- **Location Service** (8081): GPS tracking, geospatial queries
- **Notification Service** (8082): WebSocket server, real-time updates
- **Scaling Monitor** (8083): HPA watcher, email alerts (SendGrid)

**Infrastructure:**
- PostgreSQL (StatefulSet, 10GB persistent storage)
- Redis (Pub/Sub messaging, caching)
- NGINX Ingress (SSL/TLS, load balancing)

**External Services:**
- Firebase Admin SDK (authentication)
- Expo Push Notifications (mobile push)
- SendGrid (scaling alerts)

## 🌐 Deployment

**Current Deployment:** DigitalOcean Kubernetes (3 nodes)
- **Domain:** api.dropmate.ca
- **SSL/TLS:** Let's Encrypt (cert-manager)
- **Auto-scaling:** HPA enabled (CPU/Memory based)

### Domains
- `https://api.dropmate.ca` - Core API
- `https://location.dropmate.ca` - Location Service
- `https://notify.dropmate.ca` - Notification Service

### Scaling Commands
```bash
# Scale up to 4 replicas (all services)
./scale-up.sh

# Scale down to 1 replica (cost optimization)
./scale-down.sh
```

## 📊 Monitoring

```bash
# View all pods
kubectl get pods -n dropmate

# Check HPA status
kubectl get hpa -n dropmate

# View logs
kubectl logs -n dropmate -l app=core-api --tail=100

# Resource usage
kubectl top pods -n dropmate
```

## 💰 Infrastructure Cost

**Monthly (DigitalOcean):**
- Kubernetes nodes (3x s-2vcpu-4gb): $72
- NGINX Ingress LoadBalancer: $12
- Block storage (15GB): $1.50
- Container Registry: $5
- **Total: ~$90.50/month**

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Kubernetes Deployment](./docs/KUBERNETES_DEPLOYMENT.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Firebase Setup](./docs/FIREBASE_SETUP.md)
- [Push Notifications](./docs/BACKEND_PUSH_NOTIFICATIONS.md)

## 🔧 Development

### Local Setup with Docker Compose
```bash
docker-compose up -d
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Authentication secret
- `FIREBASE_PROJECT_ID` - Firebase project
- `SENDGRID_API_KEY` - Email notifications

## 🛡️ Security

- All secrets managed via Kubernetes Secrets
- Firebase authentication with JWT tokens
- HTTPS/TLS via cert-manager + Let's Encrypt
- RBAC for scaling monitor service
