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
- **1 NGINX Ingress LoadBalancer** (routes all traffic)
  - Single DigitalOcean LoadBalancer ($12/month)
  - All services are ClusterIP (internal only)
  - Routes by domain: api.dropmate.ca, location.dropmate.ca, notify.dropmate.ca
  - Handles SSL/TLS termination via cert-manager

**External Services:**
- Firebase Admin SDK (authentication)
- Expo Push Notifications (mobile push)
- SendGrid (scaling alerts)

## 🌐 Deployment to DigitalOcean Kubernetes

### Automated Setup & Deployment

The easiest way to deploy to DigitalOcean is using the automated setup script:

```bash
./scripts/setup.sh
```

This interactive script handles the entire deployment process from environment configuration to Kubernetes deployment.

### Prerequisites for Cloud Deployment

Before running the setup script, ensure you have:

1. **DigitalOcean Account** with:
   - Kubernetes cluster created (see node sizing below)
   - Container Registry created
   - API token configured

**Node Sizing Recommendations:**
- **1 node** (s-2vcpu-4gb): Development/testing (~$24/month)
  - Suitable for: Testing, single-replica deployments
  - Limitations: No high availability, downtime during node maintenance

- **2 nodes** (s-2vcpu-4gb): Small production (~$48/month) **← Current setup** ✅
  - Suitable for: Small production workloads, basic HA
  - Benefits: Pod redundancy, rolling updates without downtime
  - **Your setup**: dropmate-pool with 2x s-2vcpu-4gb nodes

- **3 nodes** (s-2vcpu-4gb): Production with auto-scaling (~$72/month)
  - Suitable for: Production with HPA enabled, full redundancy
  - Benefits: High availability, better resource distribution, room for scaling
  - Scale to this if you need more capacity

2. **Required CLI Tools**:
   ```bash
   # Install doctl (DigitalOcean CLI)
   brew install doctl  # macOS
   # or
   snap install doctl  # Linux

   # Install kubectl
   brew install kubectl  # macOS
   # or
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

   # Install Docker
   # Follow: https://docs.docker.com/get-docker/
   ```

3. **Authenticate with DigitalOcean**:
   ```bash
   # Initialize doctl with your API token
   doctl auth init

   # Verify authentication
   doctl account get
   ```

4. **Create Kubernetes Cluster** (if not already created):

   **Production Cluster (3 nodes - recommended):**
   ```bash
   doctl kubernetes cluster create dropmate-cluster \
     --region nyc1 \
     --version latest \
     --count 3 \
     --size s-2vcpu-4gb \
     --auto-upgrade=true \
     --surge-upgrade=true
   ```

   **Small Production / Staging (2 nodes):**
   ```bash
   doctl kubernetes cluster create dropmate-cluster \
     --region nyc1 \
     --version latest \
     --count 2 \
     --size s-2vcpu-4gb \
     --auto-upgrade=true \
     --surge-upgrade=true
   ```

   **Development / Testing (1 node):**
   ```bash
   doctl kubernetes cluster create dropmate-cluster \
     --region nyc1 \
     --version latest \
     --count 1 \
     --size s-2vcpu-4gb \
     --auto-upgrade=true \
     --surge-upgrade=true
   ```

   **After creation, connect kubectl:**
   ```bash
   # Connect kubectl to cluster
   doctl kubernetes cluster kubeconfig save dropmate-cluster

   # Verify cluster connection
   kubectl cluster-info
   kubectl get nodes
   ```

5. **Create Container Registry** (if not already created):
   ```bash
   doctl registry create dropmate-registry

   # Login to registry
   doctl registry login
   ```

### Running the Setup Script

The setup script is located at `./scripts/setup.sh` and provides a guided deployment experience:

```bash
# Make script executable (if not already)
chmod +x scripts/setup.sh

# Run the setup script
./scripts/setup.sh
```

### What the Setup Script Does

The script performs **7 automated steps**:

#### [1/7] Check Prerequisites
- Verifies Docker is installed
- Verifies kubectl is installed
- Verifies doctl is installed

#### [2/7] Gather Configuration
Interactively prompts for:

**DigitalOcean Configuration:**
- Container Registry name (e.g., `dropmate-1763357718`)
- Kubernetes cluster name (e.g., `dropmate-cluster`)
- Region (e.g., `nyc1`)

**Domain Configuration:**
- Base domain (e.g., `dropmate.ca`)
- API subdomain (e.g., `api.dropmate.ca`)
- Location subdomain (e.g., `location.dropmate.ca`)
- Notification subdomain (e.g., `notify.dropmate.ca`)

**Database Configuration:**
- PostgreSQL username
- PostgreSQL password (hidden input)
- Database name

**Redis Configuration:**
- Redis password (optional)

**Authentication:**
- JWT secret (auto-generated if not provided)

**Firebase Configuration:**
- Project ID
- Client email
- Private key (paste entire key)

**SendGrid Configuration:**
- API key (hidden input)
- Sender email (must be verified in SendGrid)
- Admin emails (comma-separated)

**Expo Push Notifications:**
- Access token (hidden input)

#### [3/7] Create Local Environment Files
Generates `.env` files for:
- Root directory (local development)
- `services/core-api/.env`
- `services/location-service/.env`
- `services/notification-service/.env`
- `services/scaling-monitor-service/.env`

All files configured with Kubernetes service hostnames (e.g., `dropmate-postgres:5432`)

#### [4/7] Create Kubernetes Secrets
Generates `k8s/digitalocean/01-secrets.yaml` with base64-encoded secrets:
- `postgres-secret` - Database credentials
- `app-secret` - Application secrets (JWT, DATABASE_URL, REDIS_URL)
- `firebase-secret` - Firebase Admin SDK credentials
- `expo-secret` - Expo push notification token
- `sendgrid-secret` - SendGrid email configuration

#### [5/7] Build and Push Docker Images
Prompts: "Build and push Docker images to registry? [y/N]"

If yes:
- Logs into DigitalOcean Container Registry
- Builds Docker images for all 4 services:
  - `dropmate-core-api`
  - `dropmate-location-service`
  - `dropmate-notification-service`
  - `dropmate-scaling-monitor-service`
- Tags images with registry URL
- Pushes to DigitalOcean Container Registry

#### [6/7] Deploy to Kubernetes
Prompts: "Deploy to DigitalOcean Kubernetes now? [y/N]"

If yes:
- Connects to Kubernetes cluster
- Applies manifests in order:
  1. `00-namespace.yaml` - Creates `dropmate` namespace
  2. `01-secrets.yaml` - Creates secrets
  3. `02-configmaps.yaml` - Creates config maps
  4. `03-postgres.yaml` - Deploys PostgreSQL StatefulSet
  5. `04-redis.yaml` - Deploys Redis
  6. Waits for PostgreSQL to be ready
  7. `05-core-api.yaml` - Deploys Core API
  8. `06-location-service.yaml` - Deploys Location Service
  9. `07-notification-service.yaml` - Deploys Notification Service
  10. `10-scaling-monitor-rbac.yaml` - Creates RBAC for scaling monitor
  11. `11-scaling-monitor-service.yaml` - Deploys Scaling Monitor
  12. `08-ingress.yaml` - Configures NGINX Ingress (if exists)
  13. `09-cert-manager.yaml` - Configures cert-manager (if exists)

#### [7/7] Display Summary
Shows:
- Local environment files created
- Kubernetes configuration
- Domain URLs
- Next steps for DNS configuration
- Useful kubectl commands

### Post-Deployment Steps

After running the setup script, complete these steps:

#### 1. Configure DNS Records

Get the LoadBalancer IP:
```bash
kubectl get ingress -n dropmate
```

Add DNS A records at your domain registrar:
```
api.dropmate.ca      → <LOAD_BALANCER_IP>
location.dropmate.ca → <LOAD_BALANCER_IP>
notify.dropmate.ca   → <LOAD_BALANCER_IP>
```

**For DigitalOcean Domains:**
```bash
# Get LoadBalancer IP
LB_IP=$(kubectl get ingress core-api-ingress -n dropmate -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Create DNS records (if using DigitalOcean DNS)
doctl compute domain records create dropmate.ca \
  --record-type A \
  --record-name api \
  --record-data $LB_IP \
  --record-ttl 3600

doctl compute domain records create dropmate.ca \
  --record-type A \
  --record-name location \
  --record-data $LB_IP \
  --record-ttl 3600

doctl compute domain records create dropmate.ca \
  --record-type A \
  --record-name notify \
  --record-data $LB_IP \
  --record-ttl 3600
```

#### 2. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n dropmate

# Expected output:
# NAME                                      READY   STATUS    RESTARTS   AGE
# core-api-xxxxxxxxxx-xxxxx                 1/1     Running   0          2m
# location-service-xxxxxxxxxx-xxxxx         1/1     Running   0          2m
# notification-service-xxxxxxxxxx-xxxxx     1/1     Running   0          2m
# postgres-0                                1/1     Running   0          3m
# redis-xxxxxxxxxx-xxxxx                    1/1     Running   0          3m
# scaling-monitor-service-xxxxxxxxxx-xxxxx  1/1     Running   0          2m

# Check services
kubectl get svc -n dropmate

# Check ingress
kubectl get ingress -n dropmate

# Check HPA status
kubectl get hpa -n dropmate
```

#### 3. Test Endpoints

```bash
# Wait for DNS propagation (5-15 minutes)
# Then test endpoints:

# Health check
curl https://api.dropmate.ca/health
# Expected: {"status":"healthy","service":"core-api"}

# Location service
curl https://location.dropmate.ca/health

# Notification service
curl https://notify.dropmate.ca/health
```

#### 4. Monitor Deployment

```bash
# View logs for all services
kubectl logs -n dropmate -l app=core-api --tail=50
kubectl logs -n dropmate -l app=location-service --tail=50
kubectl logs -n dropmate -l app=notification-service --tail=50

# Watch pod status
kubectl get pods -n dropmate -w

# Check resource usage
kubectl top pods -n dropmate
kubectl top nodes
```

### Manual Deployment (Alternative)

If you prefer manual deployment or need to deploy specific components:

#### 1. Build and Push Images Manually

```bash
# Set registry URL
REGISTRY="registry.digitalocean.com/dropmate-1763357718"

# Build and push core-api
cd services/core-api
docker build -t dropmate-core-api:latest .
docker tag dropmate-core-api:latest $REGISTRY/dropmate-core-api:latest
docker push $REGISTRY/dropmate-core-api:latest

# Repeat for other services
cd ../location-service
docker build -t dropmate-location-service:latest .
docker tag dropmate-location-service:latest $REGISTRY/dropmate-location-service:latest
docker push $REGISTRY/dropmate-location-service:latest

cd ../notification-service
docker build -t dropmate-notification-service:latest .
docker tag dropmate-notification-service:latest $REGISTRY/dropmate-notification-service:latest
docker push $REGISTRY/dropmate-notification-service:latest

cd ../scaling-monitor-service
docker build -t dropmate-scaling-monitor-service:latest .
docker tag dropmate-scaling-monitor-service:latest $REGISTRY/dropmate-scaling-monitor-service:latest
docker push $REGISTRY/dropmate-scaling-monitor-service:latest
```

#### 2. Create Secrets Manually

```bash
# Create secrets file
cd k8s/digitalocean

# Edit 01-secrets.yaml with your base64-encoded values
# To encode: echo -n "value" | base64

# Apply secrets
kubectl apply -f 01-secrets.yaml
```

#### 3. Deploy Services Manually

```bash
cd k8s/digitalocean

# Deploy in order
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets.yaml
kubectl apply -f 02-configmaps.yaml
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-redis.yaml

# Wait for PostgreSQL
kubectl wait --for=condition=ready pod -l app=postgres -n dropmate --timeout=120s

# Deploy services
kubectl apply -f 05-core-api.yaml
kubectl apply -f 06-location-service.yaml
kubectl apply -f 07-notification-service.yaml
kubectl apply -f 10-scaling-monitor-rbac.yaml
kubectl apply -f 11-scaling-monitor-service.yaml

# Deploy ingress
kubectl apply -f 08-ingress.yaml
```

### Updating Deployed Services

To update a service after code changes:

```bash
# 1. Build and push new image
cd services/core-api
docker build -t dropmate-core-api:latest .
docker tag dropmate-core-api:latest registry.digitalocean.com/dropmate-1763357718/dropmate-core-api:latest
docker push registry.digitalocean.com/dropmate-1763357718/dropmate-core-api:latest

# 2. Restart deployment to pull new image
kubectl rollout restart deployment/core-api -n dropmate

# 3. Monitor rollout
kubectl rollout status deployment/core-api -n dropmate

# 4. Verify new pods
kubectl get pods -n dropmate -l app=core-api
```

### Scaling Operations

After deployment, use these scripts to scale services:

```bash
# Scale up to 4 replicas (all services)
./scale-up.sh

# Scale down to 1 replica (cost optimization)
./scale-down.sh

# Manual scaling
kubectl scale deployment/core-api --replicas=4 -n dropmate
kubectl scale deployment/location-service --replicas=2 -n dropmate
```

### Current Production Deployment

- **Platform:** DigitalOcean Kubernetes (2 nodes, s-2vcpu-4gb)
- **Cluster:** dropmate-cluster
- **Region:** NYC1
- **Load Balancer:** 1 NGINX Ingress LB at `45.55.106.221` ($12/month)
- **Service Architecture:** All services are ClusterIP (internal only)
- **Monthly Cost:** $66.50/month
- **Domains** (all routed through single LB):
  - `https://api.dropmate.ca` → Core API (ClusterIP)
  - `https://location.dropmate.ca` → Location Service (ClusterIP)
  - `https://notify.dropmate.ca` → Notification Service (ClusterIP)
- **SSL/TLS:** Let's Encrypt via cert-manager (handled by NGINX Ingress)
- **Auto-scaling:** HPA enabled (CPU/Memory 90% threshold)
- **Monitoring:** Scaling alerts via SendGrid email

**Traffic Flow:**
```
Internet → [DigitalOcean LB: 45.55.106.221]
              ↓
           [NGINX Ingress Controller]
              ↓
      ┌───────┴────────┬──────────────┐
      ↓                ↓              ↓
   core-api    location-service  notification-service
   (ClusterIP)    (ClusterIP)       (ClusterIP)
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

**Monthly Cost Estimates (DigitalOcean):**

| Configuration | Nodes | Node Cost | LB | Storage | Registry | **Total** |
|--------------|-------|-----------|-----|---------|----------|-----------|
| **Development** | 1x s-2vcpu-4gb | $24 | $12 | $1.50 | $5 | **~$42.50/mo** |
| **Small Production (Current)** | 2x s-2vcpu-4gb | $48 | $12 | $1.50 | $5 | **~$66.50/mo** ✅ |
| **Production (Scaled)** | 3x s-2vcpu-4gb | $72 | $12 | $1.50 | $5 | **~$90.50/mo** |

**Current Setup:**
- **Cluster**: dropmate-cluster (nyc1)
- **Node Pool**: dropmate-pool with 2x s-2vcpu-4gb nodes
- **Storage**: 15GB (10GB PostgreSQL + 5GB Redis)
- **Load Balancer**: 1 NGINX Ingress (lb-small) at 45.55.106.221
- **Monthly Cost**: **$66.50/month**

**Cost Breakdown:**
- **Kubernetes nodes** (s-2vcpu-4gb): $24/month per node
- **NGINX Ingress LoadBalancer** (lb-small): $12/month
- **Block storage** (15GB for PostgreSQL + Redis): $1.50/month ($0.10/GB)
- **Container Registry**: $5/month
- **SendGrid** (email alerts): Free tier (100 emails/day)

**Cost Optimization Tips:**
- Current 2-node setup provides good balance of cost and availability
- Use `./scale-down.sh` during off-peak hours to reduce pod replicas
- Monitor resource usage: `kubectl top nodes`

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Kubernetes Deployment](./docs/KUBERNETES_DEPLOYMENT.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Firebase Setup](./docs/FIREBASE_SETUP.md)
- [Push Notifications](./docs/BACKEND_PUSH_NOTIFICATIONS.md)

## 🔧 Development

### Prerequisites

Before starting local development, ensure you have:
- **Node.js** 20+ installed
- **Docker** and **Docker Compose** installed
- **PostgreSQL** client (optional, for manual DB access)
- **Firebase** service account credentials
- **Expo** access token (for push notifications)
- **SendGrid** API key (optional, for testing email alerts)

### Initial Setup

#### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/kevinlin29/dropmate-backend.git
cd dropmate-backend

# Install dependencies for all services
npm install
cd services/core-api && npm install && cd ../..
cd services/location-service && npm install && cd ../..
cd services/notification-service && npm install && cd ../..
cd services/scaling-monitor-service && npm install && cd ../..
```

#### 2. Configure Environment Variables

Create `.env` file in the root directory:

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

**Required Environment Variables:**

```bash
# Database (local development)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dropmate

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-generate-with-openssl

# Firebase Admin SDK (required for authentication)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----\n"

# Expo Push Notifications (required for mobile push)
EXPO_ACCESS_TOKEN=your-expo-access-token

# SendGrid (optional for local dev, required for scaling alerts)
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_SENDER_EMAIL=noreply@dropmate.com
ADMIN_EMAILS=admin@dropmate.com

# Application
NODE_ENV=development
PORT=8080
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

#### 3. Start Infrastructure with Docker Compose

Start PostgreSQL and Redis:

```bash
# Start all infrastructure services
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                COMMAND                  SERVICE             STATUS              PORTS
# dropmate-postgres   "docker-entrypoint..."   postgres            running             0.0.0.0:5432->5432/tcp
# dropmate-redis      "docker-entrypoint..."   redis               running             0.0.0.0:6379->6379/tcp
```

#### 4. Initialize Database

Run database migrations:

```bash
cd services/core-api

# Run migrations
npm run migrate

# Seed database with test data (optional)
npm run seed
```

**Manual Database Setup (if needed):**

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/postgres

# Create database
CREATE DATABASE dropmate;

# Connect to dropmate database
\c dropmate

# Run schema files from schema/ directory
\i schema/01_initial_schema.sql
\i schema/02_firebase_auth.sql
```

### Running Services Locally

#### Option 1: Run All Services Together

```bash
# From root directory
npm run dev:all
```

This starts all services concurrently:
- Core API: http://localhost:8080
- Location Service: http://localhost:8081
- Notification Service: http://localhost:8082

#### Option 2: Run Services Individually

**Terminal 1 - Core API:**
```bash
cd services/core-api
npm run dev

# Service available at http://localhost:8080
```

**Terminal 2 - Location Service:**
```bash
cd services/location-service
npm run dev

# Service available at http://localhost:8081
```

**Terminal 3 - Notification Service:**
```bash
cd services/notification-service
npm run dev

# Service available at http://localhost:8082
```

**Terminal 4 - Scaling Monitor (optional):**
```bash
cd services/scaling-monitor-service
npm run dev

# Service available at http://localhost:8083
# Note: Requires kubectl access to K8s cluster
```

### Testing the Setup

#### 1. Check Health Endpoints

```bash
# Core API
curl http://localhost:8080/health
# Expected: {"status":"healthy","service":"core-api"}

# Location Service
curl http://localhost:8081/health
# Expected: {"status":"healthy","service":"location-service"}

# Notification Service
curl http://localhost:8082/health
# Expected: {"status":"healthy","service":"notification-service"}
```

#### 2. Test Authentication

Generate a test Firebase token:

```bash
node scripts/get-test-token.js
```

Use the token to test authenticated endpoints:

```bash
# Get shipments (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:8080/api/shipments
```

#### 3. Test Real-time Notifications

Connect to WebSocket server:

```bash
# Using wscat (install: npm install -g wscat)
wscat -c ws://localhost:8082

# Subscribe to shipment updates
> {"event": "subscribe:shipment", "shipmentId": "123"}
```

#### 4. Test Location Tracking

```bash
# Send driver location
curl -X POST http://localhost:8081/api/location/driver-123 \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }'
```

### Development Workflow

#### Code Changes and Hot Reload

All services use `nodemon` for automatic restart on file changes:

```bash
# In any service directory
npm run dev

# Nodemon will watch for changes in:
# - *.js files
# - *.json files (package.json, etc.)
```

#### Database Changes

```bash
# Create a new migration
cd services/core-api
npm run migrate:create add_new_table

# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback
```

#### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/core-api
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

#### Debugging

**Using VS Code Debugger:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Core API",
      "program": "${workspaceFolder}/services/core-api/src/server.js",
      "envFile": "${workspaceFolder}/services/core-api/.env",
      "console": "integratedTerminal"
    }
  ]
}
```

**Using Node Inspector:**

```bash
cd services/core-api
node --inspect src/server.js

# Open Chrome DevTools: chrome://inspect
```

### Utility Scripts

#### Generate Test Token

```bash
node scripts/get-test-token.js

# Output: Firebase custom token for testing
```

#### Reset Driver Password

```bash
node scripts/reset-driver-password.js driver@example.com newPassword123
```

#### Test Shipment Flow

```bash
node scripts/test-shipment-flow.js

# Simulates complete shipment lifecycle:
# 1. Create shipment
# 2. Assign driver
# 3. Update status
# 4. Complete delivery
```

### Troubleshooting

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d
npm run migrate
```

#### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Clear Redis cache
redis-cli -h localhost -p 6379 FLUSHALL
```

#### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>

# Or use different port
PORT=8081 npm run dev
```

#### Firebase Authentication Errors

```bash
# Verify Firebase credentials
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Test Firebase connection
node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});
console.log('✓ Firebase initialized successfully');
"
```

### Docker Compose Services

**View running services:**
```bash
docker-compose ps
```

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

**Stop services:**
```bash
docker-compose down

# Stop and remove volumes (deletes data)
docker-compose down -v
```

**Rebuild services:**
```bash
docker-compose up -d --build
```

### Best Practices for Local Development

1. **Use Environment Variables**: Never hardcode secrets in code
2. **Run Tests Before Committing**: `npm test`
3. **Keep Dependencies Updated**: `npm outdated`
4. **Use Feature Branches**: `git checkout -b feature/my-feature`
5. **Follow Code Style**: ESLint and Prettier are configured
6. **Write Tests**: Add tests for new features
7. **Document API Changes**: Update API_DOCUMENTATION.md
8. **Clean Up Docker**: Regularly prune unused containers/images

## 🛡️ Security

- All secrets managed via Kubernetes Secrets
- Firebase authentication with JWT tokens
- HTTPS/TLS via cert-manager + Let's Encrypt
- RBAC for scaling monitor service
