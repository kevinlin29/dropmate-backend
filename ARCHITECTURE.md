# DropMate Backend - Cloud Native Microservices Architecture

## System Overview

DropMate is a cloud-native delivery tracking platform built with a microservices architecture deployed on Kubernetes (Digital Ocean). The system provides real-time GPS tracking, push notifications, and comprehensive shipment management.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Mobile App      │  │  Driver App      │  │  Web Dashboard   │             │
│  │  (React Native/  │  │  (React Native/  │  │  (React)         │             │
│  │   Expo)          │  │   Expo)          │  │                  │             │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘             │
│          │                      │                      │                        │
│          │ HTTP/WS              │ HTTP/WS              │ HTTP/WS                │
│          └──────────────────────┴──────────────────────┘                        │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        │ HTTPS (TLS/SSL)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     KUBERNETES CLUSTER (Digital Ocean)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │                    INGRESS CONTROLLER (NGINX)                        │       │
│  │  ┌──────────────────────────────────────────────────────────────┐   │       │
│  │  │  • SSL/TLS Termination (Let's Encrypt)                       │   │       │
│  │  │  • Load Balancing                                            │   │       │
│  │  │  • Path-based Routing                                        │   │       │
│  │  │  • WebSocket Support                                         │   │       │
│  │  └──────────────────────────────────────────────────────────────┘   │       │
│  │         │                    │                      │                │       │
│  │         │ /api/*             │ /api/location/*     │ /ws             │       │
│  └─────────┼────────────────────┼─────────────────────┼────────────────┘       │
│            │                    │                      │                        │
│  ┌─────────▼──────────┐  ┌──────▼──────────┐  ┌───────▼──────────┐            │
│  │  CORE API SERVICE  │  │ LOCATION SERVICE │  │ NOTIFICATION SVC │            │
│  │  (Port 8080)       │  │ (Port 8081)      │  │ (Port 8082)      │            │
│  ├────────────────────┤  ├─────────────────┤  ├──────────────────┤            │
│  │ • REST APIs        │  │ • GPS Tracking   │  │ • WebSocket Server│           │
│  │ • Authentication   │  │ • Driver Location│  │ • Real-time Push │            │
│  │ • Shipment CRUD    │  │ • Geospatial     │  │ • Pub/Sub Relay  │            │
│  │ • Order Mgmt       │  │   Queries        │  │ • Connection Mgmt│            │
│  │ • Driver Mgmt      │  │ • Location Hist. │  │                  │            │
│  │ • User Management  │  │ • Proximity Det. │  │                  │            │
│  │ • WebSocket Events │  │                  │  │                  │            │
│  │ • Push Notif.      │  │                  │  │                  │            │
│  ├────────────────────┤  ├─────────────────┤  ├──────────────────┤            │
│  │ Replicas: 2-10     │  │ Replicas: 1-5    │  │ Replicas: 1-3    │            │
│  │ (Auto-scaling)     │  │ (Auto-scaling)   │  │ (Auto-scaling)   │            │
│  └────────┬───────────┘  └─────┬───────────┘  └──────┬───────────┘            │
│           │                    │                      │                         │
│           │                    │                      │                         │
│           │      ┌─────────────┴──────────────────────┘                         │
│           │      │                    │                                         │
│           │      │                    │                                         │
│  ┌────────▼──────▼──────┐    ┌───────▼────────────┐                            │
│  │   REDIS CLUSTER      │    │   POSTGRESQL DB    │                            │
│  │   (Port 6379)        │    │   (Port 5432)      │                            │
│  ├──────────────────────┤    ├────────────────────┤                            │
│  │ • Pub/Sub Messaging  │    │ • Users            │                            │
│  │ • Location Broadcast │    │ • Customers        │                            │
│  │ • Shipment Updates   │    │ • Drivers          │                            │
│  │ • Real-time Events   │    │ • Orders           │                            │
│  │ • Session Store      │    │ • Shipments        │                            │
│  │                      │    │ • Messages         │                            │
│  │ Channels:            │    │ • Push Tokens      │                            │
│  │ • driver:*:location  │    │ • Partitioned:     │                            │
│  │ • shipment:*:location│    │   - location_events│                            │
│  └──────────────────────┘    │   - shipment_events│                            │
│                               │   - webhook_events │                            │
│                               ├────────────────────┤                            │
│                               │ StatefulSet (1)    │                            │
│                               │ PVC: 10Gi          │                            │
│                               └────────────────────┘                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ External APIs
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────────┐         ┌──────────────────────────┐                │
│  │  FIREBASE ADMIN SDK   │         │  EXPO PUSH NOTIFICATIONS │                │
│  ├───────────────────────┤         ├──────────────────────────┤                │
│  │ • User Authentication │         │ • Push Notifications     │                │
│  │ • Custom Tokens       │         │ • Multi-device Support   │                │
│  │ • User Management     │         │ • Delivery Receipts      │                │
│  │ • Token Verification  │         │ • Badge Management       │                │
│  └───────────────────────┘         └──────────────────────────┘                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. **Core API Service**
**Technology**: Node.js (Express) + Socket.IO
**Responsibilities**:
- RESTful API endpoints for all business logic
- User authentication & authorization (JWT + Firebase)
- Shipment lifecycle management (CRUD operations)
- Order processing and management
- Driver management and assignment
- Real-time WebSocket events for status updates
- Push notification orchestration
- Message handling between customers and drivers

**Key Endpoints**:
- `POST /api/auth/login` - User authentication
- `GET /api/shipments` - List all shipments
- `GET /api/shipments/:id` - Get shipment details
- `PATCH /api/shipments/:id/status` - Update shipment status
- `PATCH /api/shipments/:id/package-status` - Update package delivery status
- `POST /api/shipments/:id/assign-driver` - Assign driver to shipment
- `GET /api/shipments/:id/events` - Get shipment event history
- `GET /api/orders` - Order management
- `POST /api/drivers` - Driver registration
- `POST /api/messages` - Customer-driver messaging

**WebSocket Events**:
- `shipment_status_updated` - Broadcast shipment status changes
- `package_status_updated` - Broadcast package status changes
- `shipment_assigned` - Driver assignment notifications
- `shipment_updated` - General shipment updates

**Scaling**:
- Min: 2 replicas, Max: 10 replicas
- CPU-based autoscaling (70% threshold)
- Memory-based autoscaling (80% threshold)

---

### 2. **Location Service**
**Technology**: Node.js (Express) + Redis
**Responsibilities**:
- High-frequency GPS location ingestion from drivers
- Real-time location broadcasting via Redis Pub/Sub
- Location history queries
- Geospatial calculations and proximity detection
- Shipment-to-driver location correlation

**Key Endpoints**:
- `POST /api/location/:driverId` - Record driver GPS location
- `GET /api/location/:driverId/latest` - Get latest driver location
- `GET /api/location/:driverId/history` - Get location history
- `GET /api/location/shipment/:shipmentId` - Get shipment's driver location

**Data Flow**:
1. Driver app sends GPS coordinates (lat/lng/accuracy)
2. Store in partitioned `driver_location_events` table (PostgreSQL)
3. Publish to Redis channels: `driver:{id}:location`
4. Query active shipments for driver
5. Publish to Redis channels: `shipment:{id}:location`

**Scaling**: Min: 1 replica, Max: 5 replicas

---

### 3. **Notification Service**
**Technology**: Node.js (Socket.IO) + Redis Pub/Sub
**Responsibilities**:
- WebSocket server for real-time client connections
- Redis subscriber for location and shipment updates
- Room-based message broadcasting
- Connection state management
- Subscription management (driver/shipment channels)

**WebSocket Events (Client → Server)**:
- `subscribe:driver` - Subscribe to driver location updates
- `subscribe:shipment` - Subscribe to shipment location updates
- `unsubscribe:driver` - Unsubscribe from driver updates
- `unsubscribe:shipment` - Unsubscribe from shipment updates

**WebSocket Events (Server → Client)**:
- `driver_location_updated` - Real-time driver GPS updates
- `shipment_location_updated` - Real-time shipment location updates
- `connected` - Connection acknowledgment

**Redis Subscriptions**:
- Pattern: `driver:*:location` - All driver location updates
- Pattern: `shipment:*:location` - All shipment location updates

**Scaling**: Min: 1 replica, Max: 3 replicas

---

### 4. **PostgreSQL Database**
**Technology**: PostgreSQL 16 (StatefulSet)
**Configuration**:
- Single instance (can be upgraded to HA with replicas)
- Persistent Volume Claim: 10Gi
- Partitioned tables for high-write throughput

**Schema Overview**:

**Core Tables**:
- `users` - Authentication (email, password_hash, role)
- `customers` - Customer profiles
- `drivers` - Driver profiles (vehicle, license, status)
- `orders` - Order records
- `shipments` - Package/shipment tracking
- `messages` - Customer-driver communication
- `push_tokens` - Expo push notification tokens

**Partitioned Tables** (for scalability):
- `driver_location_events` - GPS tracking (partitioned by `occurred_at`)
- `shipment_events` - Status change audit log (partitioned by `occurred_at`)
- `webhook_events` - External webhook queue (partitioned by `occurred_at`)

**Indexes**:
- Geospatial indexes on pickup/delivery coordinates
- Time-series indexes on event tables
- Tracking number unique index
- Driver/shipment foreign key indexes

---

### 5. **Redis**
**Technology**: Redis 7 (Alpine)
**Use Cases**:
- **Pub/Sub Messaging**: Real-time event broadcasting
- **Location Broadcasting**: GPS updates to connected clients
- **Session Store**: (Future) User session management
- **Caching**: (Future) API response caching

**Channel Patterns**:
- `driver:{driverId}:location` - Individual driver location updates
- `shipment:{shipmentId}:location` - Individual shipment location updates

---

### 6. **Nginx Ingress Controller**
**Responsibilities**:
- SSL/TLS termination (Let's Encrypt certificates)
- Load balancing across service replicas
- Path-based routing to microservices
- WebSocket connection upgrade support
- Health check proxying

**Routing Rules**:
- `api.dropmate.com/*` → Core API Service
- `location.dropmate.com/*` → Location Service
- `ws.dropmate.com/*` → Notification Service

---

### 7. **External Services**

#### **Firebase Admin SDK**
- Custom token generation for authentication
- User management and verification
- Integration with mobile apps for seamless auth

#### **Expo Push Notification Service**
- Multi-device push notifications
- Notification types:
  - Shipment status updates
  - Package delivery status
  - Driver proximity alerts
  - Message notifications

---

## Data Flow Examples

### 1. **Real-time Location Tracking Flow**

```
1. Driver App (Mobile)
   │
   └─> POST /api/location/{driverId}
       {"latitude": 40.7128, "longitude": -74.0060, "accuracy": 10}
       │
       ▼
2. Location Service
   ├─> Store in PostgreSQL (driver_location_events)
   └─> Publish to Redis:
       ├─> Channel: driver:123:location
       └─> Channel: shipment:456:location (if driver has active shipment)
       │
       ▼
3. Notification Service (Redis Subscriber)
   │
   └─> Receives Redis message
       │
       ▼
4. WebSocket Broadcasting
   ├─> Emit to room: driver:123
   └─> Emit to room: shipment:456
       │
       ▼
5. Customer App (Mobile)
   │
   └─> Receives: shipment_location_updated event
       └─> Updates map with driver location
```

### 2. **Shipment Status Update Flow**

```
1. Admin/Driver Action
   │
   └─> PATCH /api/shipments/123/status
       {"status": "delivered"}
       │
       ▼
2. Core API Service
   ├─> Update PostgreSQL (shipments table)
   ├─> Log event (shipment_events table)
   ├─> Get customer_id from order
   ├─> Emit WebSocket event (shipment_status_updated)
   └─> Trigger Push Notification
       │
       ▼
3. Push Notification Service
   ├─> Query push_tokens table for user
   └─> Send via Expo Push API
       │
       ▼
4. Customer receives:
   ├─> WebSocket event (real-time UI update)
   └─> Push notification (if app in background)
```

---

## Scalability & Performance Features

### **Horizontal Pod Autoscaling (HPA)**
- Core API: 2-10 replicas (CPU 70%, Memory 80%)
- Location Service: 1-5 replicas
- Notification Service: 1-3 replicas

### **Database Partitioning**
- Time-based partitioning on high-write tables
- Automatic partition management (monthly/daily)
- Reduces index size and improves query performance

### **Geospatial Indexing**
- Pickup/delivery coordinate indexes
- Fast proximity queries for driver-to-customer distance

### **Connection Pooling**
- PostgreSQL connection pool (pg library)
- Redis connection reuse

### **Stateless Services**
- All services are stateless for easy horizontal scaling
- Session data in Redis (future)

---

## Security Features

### **Authentication & Authorization**
- JWT tokens for API authentication
- Firebase custom tokens for mobile apps
- Role-based access control (customer, driver, admin)
- Middleware-based route protection

### **Network Security**
- HTTPS/TLS encryption (Let's Encrypt)
- CORS configuration for API access
- Kubernetes network policies (can be added)

### **Data Security**
- Password hashing (bcrypt)
- Sensitive credentials in Kubernetes Secrets
- Firebase Admin SDK private key encryption

---

## Monitoring & Observability

### **Health Checks**
- `/health` endpoints on all services
- Kubernetes liveness probes (every 10s)
- Kubernetes readiness probes (every 5s)

### **Logging**
- Structured console logging
- Request/response logging
- Error tracking and stack traces

### **Metrics** (Future)
- Prometheus metrics collection
- Grafana dashboards
- Service performance monitoring

---

## Deployment Strategy

### **Container Registry**
- Digital Ocean Container Registry
- Automated builds with version tags
- Image pull secrets for private registry

### **Kubernetes Resources**
- Namespace: `dropmate`
- ConfigMaps: Environment configuration
- Secrets: Sensitive credentials
- Services: LoadBalancer type for external access
- Deployments: Replica management
- StatefulSets: PostgreSQL persistence
- HPA: Auto-scaling configuration

### **CI/CD** (Recommended)
- GitHub Actions for automated builds
- Docker image build and push
- Kubernetes rolling updates
- Zero-downtime deployments

---

## Technology Stack Summary

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | Latest LTS |
| API Framework | Express | 4.x |
| WebSocket | Socket.IO | 4.x |
| Database | PostgreSQL | 16 |
| Cache/Pub-Sub | Redis | 7 |
| Container Orchestration | Kubernetes | Latest |
| Cloud Provider | Digital Ocean | - |
| Ingress | Nginx Ingress Controller | Latest |
| SSL/TLS | Let's Encrypt (cert-manager) | - |
| Authentication | Firebase Admin SDK | 13.x |
| Push Notifications | Expo Server SDK | 3.x |
| ORM/Query | Raw SQL (pg) | 8.x |

---

## Cloud Native Principles Applied

✅ **Microservices Architecture** - Separate services for core logic, location tracking, and notifications
✅ **Containerization** - All services containerized with Docker
✅ **Orchestration** - Kubernetes for deployment, scaling, and management
✅ **Auto-scaling** - Horizontal Pod Autoscaling based on CPU/memory
✅ **Service Discovery** - Kubernetes DNS and Services
✅ **Health Checks** - Liveness and readiness probes
✅ **Configuration Management** - ConfigMaps and Secrets
✅ **Observability** - Health endpoints and structured logging
✅ **Stateless Services** - Easy horizontal scaling
✅ **Persistent Storage** - StatefulSets with PVCs for databases
✅ **Load Balancing** - Kubernetes Services + Ingress
✅ **API Gateway** - Nginx Ingress with SSL termination

---

## Future Enhancements

- [ ] Service Mesh (Istio/Linkerd) for advanced traffic management
- [ ] Prometheus + Grafana monitoring stack
- [ ] Distributed tracing (Jaeger/OpenTelemetry)
- [ ] Message queue (RabbitMQ/Kafka) for async processing
- [ ] Database replication and HA setup
- [ ] CDN integration for static assets
- [ ] Rate limiting and API throttling
- [ ] Automated backups and disaster recovery
- [ ] Blue-green deployments
- [ ] Canary releases

---

**Last Updated**: November 2025
**Author**: DropMate Engineering Team
