#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        DropMate Backend - Setup & Deployment            ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo ""

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local value

    if [ -n "$default" ]; then
        read -p "$(echo -e ${GREEN}${prompt}${NC} [${YELLOW}${default}${NC}]: )" value
        echo "${value:-$default}"
    else
        read -p "$(echo -e ${GREEN}${prompt}${NC}: )" value
        echo "$value"
    fi
}

# Function to prompt for secret (hidden input)
prompt_secret() {
    local prompt="$1"
    local value

    read -s -p "$(echo -e ${GREEN}${prompt}${NC}: )" value
    echo ""
    echo "$value"
}

# Function to base64 encode
base64_encode() {
    echo -n "$1" | base64 -w 0 2>/dev/null || echo -n "$1" | base64
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"

    local missing=0

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ Docker found${NC}"
    fi

    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}✗ kubectl not found${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ kubectl found${NC}"
    fi

    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}✗ doctl not found${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ doctl found${NC}"
    fi

    if [ $missing -eq 1 ]; then
        echo -e "${RED}Missing required tools. Please install them first.${NC}"
        exit 1
    fi

    echo ""
}

# Gather configuration
gather_config() {
    echo -e "${BLUE}[2/7] Gathering configuration...${NC}"
    echo ""

    # DigitalOcean
    echo -e "${YELLOW}=== DigitalOcean Configuration ===${NC}"
    DO_REGISTRY=$(prompt_with_default "DO Container Registry name" "dropmate-1763357718")
    DO_CLUSTER=$(prompt_with_default "DO Kubernetes cluster name" "dropmate-cluster")
    DO_REGION=$(prompt_with_default "DO Region" "nyc1")
    echo ""

    # Domain configuration
    echo -e "${YELLOW}=== Domain Configuration ===${NC}"
    DOMAIN_BASE=$(prompt_with_default "Base domain" "dropmate.ca")
    API_DOMAIN=$(prompt_with_default "API subdomain" "api.${DOMAIN_BASE}")
    LOCATION_DOMAIN=$(prompt_with_default "Location subdomain" "location.${DOMAIN_BASE}")
    NOTIFY_DOMAIN=$(prompt_with_default "Notification subdomain" "notify.${DOMAIN_BASE}")
    echo ""

    # Database
    echo -e "${YELLOW}=== Database Configuration ===${NC}"
    DB_USER=$(prompt_with_default "PostgreSQL username" "postgres")
    DB_PASSWORD=$(prompt_secret "PostgreSQL password")
    DB_NAME=$(prompt_with_default "Database name" "dropmate")
    echo ""

    # Redis
    echo -e "${YELLOW}=== Redis Configuration ===${NC}"
    REDIS_PASSWORD=$(prompt_secret "Redis password (leave empty for no auth)")
    echo ""

    # JWT
    echo -e "${YELLOW}=== Authentication ===${NC}"
    JWT_SECRET=$(prompt_with_default "JWT secret" "$(openssl rand -base64 32)")
    echo ""

    # Firebase
    echo -e "${YELLOW}=== Firebase Configuration ===${NC}"
    FIREBASE_PROJECT_ID=$(prompt_with_default "Firebase project ID" "dropmate-9dc10")
    FIREBASE_CLIENT_EMAIL=$(prompt_with_default "Firebase client email" "firebase-adminsdk-fbsvc@dropmate-9dc10.iam.gserviceaccount.com")
    echo -e "${YELLOW}Firebase private key (paste the entire key including BEGIN/END):${NC}"
    FIREBASE_PRIVATE_KEY=""
    while IFS= read -r line; do
        [[ "$line" == *"END PRIVATE KEY"* ]] && FIREBASE_PRIVATE_KEY+="$line" && break
        FIREBASE_PRIVATE_KEY+="$line"$'\n'
    done
    echo ""

    # SendGrid
    echo -e "${YELLOW}=== SendGrid Configuration (for scaling alerts) ===${NC}"
    SENDGRID_API_KEY=$(prompt_secret "SendGrid API key")
    SENDGRID_SENDER=$(prompt_with_default "SendGrid sender email" "info@${DOMAIN_BASE}")
    ADMIN_EMAILS=$(prompt_with_default "Admin emails (comma-separated)" "info@${DOMAIN_BASE}")
    echo ""

    # Expo Push Notifications
    echo -e "${YELLOW}=== Expo Push Notifications ===${NC}"
    EXPO_ACCESS_TOKEN=$(prompt_secret "Expo access token")
    echo ""
}

# Create local .env files
create_local_env() {
    echo -e "${BLUE}[3/7] Creating local environment files...${NC}"

    # Root .env
    cat > "${SCRIPT_DIR}/.env" <<EOF
# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# Redis
REDIS_URL=redis://localhost:6379
$([ -n "$REDIS_PASSWORD" ] && echo "REDIS_PASSWORD=${REDIS_PASSWORD}")

# Authentication
JWT_SECRET=${JWT_SECRET}

# Firebase
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}"

# SendGrid
SENDGRID_API_KEY=${SENDGRID_API_KEY}
SENDGRID_SENDER_EMAIL=${SENDGRID_SENDER}
ADMIN_EMAILS=${ADMIN_EMAILS}

# Expo Push Notifications
EXPO_ACCESS_TOKEN=${EXPO_ACCESS_TOKEN}

# Environment
NODE_ENV=development
PORT=8080
EOF

    echo -e "${GREEN}✓ Created .env${NC}"

    # Core API .env
    mkdir -p "${SCRIPT_DIR}/services/core-api"
    cat > "${SCRIPT_DIR}/services/core-api/.env" <<EOF
# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@dropmate-postgres:5432/${DB_NAME}

# Redis
REDIS_URL=redis://redis-service:6379

# Authentication
JWT_SECRET=${JWT_SECRET}

# Firebase
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}"

# Expo Push Notifications
EXPO_ACCESS_TOKEN=${EXPO_ACCESS_TOKEN}

# Service
PORT=8080
NODE_ENV=production
EOF

    echo -e "${GREEN}✓ Created services/core-api/.env${NC}"

    # Location Service .env
    mkdir -p "${SCRIPT_DIR}/services/location-service"
    cat > "${SCRIPT_DIR}/services/location-service/.env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@dropmate-postgres:5432/${DB_NAME}
REDIS_URL=redis://redis-service:6379
PORT=8081
NODE_ENV=production
EOF

    echo -e "${GREEN}✓ Created services/location-service/.env${NC}"

    # Notification Service .env
    mkdir -p "${SCRIPT_DIR}/services/notification-service"
    cat > "${SCRIPT_DIR}/services/notification-service/.env" <<EOF
REDIS_URL=redis://redis-service:6379
PORT=8082
NODE_ENV=production
EOF

    echo -e "${GREEN}✓ Created services/notification-service/.env${NC}"

    # Scaling Monitor Service .env
    mkdir -p "${SCRIPT_DIR}/services/scaling-monitor-service"
    cat > "${SCRIPT_DIR}/services/scaling-monitor-service/.env" <<EOF
K8S_NAMESPACE=dropmate
WATCHED_HPAS=core-api-hpa,location-service-hpa,notification-service-hpa
SENDGRID_API_KEY=${SENDGRID_API_KEY}
SENDGRID_SENDER_EMAIL=${SENDGRID_SENDER}
ADMIN_EMAILS=${ADMIN_EMAILS}
DEDUP_WINDOW_MINUTES=5
PORT=8083
NODE_ENV=production
EOF

    echo -e "${GREEN}✓ Created services/scaling-monitor-service/.env${NC}"
    echo ""
}

# Create Kubernetes secrets
create_k8s_secrets() {
    echo -e "${BLUE}[4/7] Creating Kubernetes secrets...${NC}"

    # Construct DATABASE_URL for Kubernetes
    DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@dropmate-postgres:5432/${DB_NAME}"
    REDIS_URL_K8S="redis://redis-service:6379"

    cat > "${SCRIPT_DIR}/k8s/digitalocean/01-secrets.yaml" <<EOF
# WARNING: This file contains actual secrets
# DO NOT commit this file to Git!
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: dropmate
type: Opaque
data:
  POSTGRES_USER: $(base64_encode "${DB_USER}")
  POSTGRES_PASSWORD: $(base64_encode "${DB_PASSWORD}")
  POSTGRES_DB: $(base64_encode "${DB_NAME}")
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: dropmate
type: Opaque
data:
  DATABASE_URL: $(base64_encode "${DB_URL}")
  JWT_SECRET: $(base64_encode "${JWT_SECRET}")
  REDIS_URL: $(base64_encode "${REDIS_URL_K8S}")
---
apiVersion: v1
kind: Secret
metadata:
  name: firebase-secret
  namespace: dropmate
type: Opaque
data:
  FIREBASE_PROJECT_ID: $(base64_encode "${FIREBASE_PROJECT_ID}")
  FIREBASE_CLIENT_EMAIL: $(base64_encode "${FIREBASE_CLIENT_EMAIL}")
  FIREBASE_PRIVATE_KEY: $(base64_encode "${FIREBASE_PRIVATE_KEY}")
---
apiVersion: v1
kind: Secret
metadata:
  name: expo-secret
  namespace: dropmate
type: Opaque
data:
  EXPO_ACCESS_TOKEN: $(base64_encode "${EXPO_ACCESS_TOKEN}")
---
apiVersion: v1
kind: Secret
metadata:
  name: sendgrid-secret
  namespace: dropmate
type: Opaque
data:
  SENDGRID_API_KEY: $(base64_encode "${SENDGRID_API_KEY}")
  SENDGRID_SENDER_EMAIL: $(base64_encode "${SENDGRID_SENDER}")
  ADMIN_EMAILS: $(base64_encode "${ADMIN_EMAILS}")
EOF

    echo -e "${GREEN}✓ Created k8s/digitalocean/01-secrets.yaml${NC}"
    echo ""
}

# Build and push Docker images
build_and_push() {
    echo -e "${BLUE}[5/7] Building and pushing Docker images...${NC}"

    read -p "$(echo -e ${YELLOW}Build and push Docker images to registry? [y/N]:${NC} )" -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⊘ Skipping Docker build${NC}"
        echo ""
        return
    fi

    # Login to DigitalOcean registry
    echo -e "${BLUE}Logging into DigitalOcean registry...${NC}"
    doctl registry login

    REGISTRY="registry.digitalocean.com/${DO_REGISTRY}"

    # Build and push each service
    SERVICES=("core-api" "location-service" "notification-service" "scaling-monitor-service")

    for service in "${SERVICES[@]}"; do
        echo -e "${BLUE}Building ${service}...${NC}"

        docker build -t "dropmate-${service}:latest" \
            -f "${SCRIPT_DIR}/services/${service}/Dockerfile" \
            "${SCRIPT_DIR}/services/${service}"

        docker tag "dropmate-${service}:latest" "${REGISTRY}/dropmate-${service}:latest"
        docker push "${REGISTRY}/dropmate-${service}:latest"

        echo -e "${GREEN}✓ Built and pushed ${service}${NC}"
    done

    echo ""
}

# Deploy to Kubernetes
deploy_to_k8s() {
    echo -e "${BLUE}[6/7] Deploying to Kubernetes...${NC}"

    read -p "$(echo -e ${YELLOW}Deploy to DigitalOcean Kubernetes now? [y/N]:${NC} )" -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⊘ Skipping deployment${NC}"
        echo ""
        return
    fi

    # Connect to cluster
    echo -e "${BLUE}Connecting to Kubernetes cluster...${NC}"
    doctl kubernetes cluster kubeconfig save "${DO_CLUSTER}"

    # Apply manifests in order
    echo -e "${BLUE}Applying Kubernetes manifests...${NC}"

    cd "${SCRIPT_DIR}/k8s/digitalocean"

    kubectl apply -f 00-namespace.yaml
    echo -e "${GREEN}✓ Namespace created${NC}"

    kubectl apply -f 01-secrets.yaml
    echo -e "${GREEN}✓ Secrets created${NC}"

    kubectl apply -f 02-configmaps.yaml
    echo -e "${GREEN}✓ ConfigMaps created${NC}"

    kubectl apply -f 03-postgres.yaml
    echo -e "${GREEN}✓ PostgreSQL deployed${NC}"

    kubectl apply -f 04-redis.yaml
    echo -e "${GREEN}✓ Redis deployed${NC}"

    # Wait for database to be ready
    echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
    kubectl wait --for=condition=ready pod -l app=postgres -n dropmate --timeout=120s || true

    kubectl apply -f 05-core-api.yaml
    echo -e "${GREEN}✓ Core API deployed${NC}"

    kubectl apply -f 06-location-service.yaml
    echo -e "${GREEN}✓ Location Service deployed${NC}"

    kubectl apply -f 07-notification-service.yaml
    echo -e "${GREEN}✓ Notification Service deployed${NC}"

    kubectl apply -f 10-scaling-monitor-rbac.yaml
    echo -e "${GREEN}✓ Scaling Monitor RBAC created${NC}"

    kubectl apply -f 11-scaling-monitor-service.yaml
    echo -e "${GREEN}✓ Scaling Monitor Service deployed${NC}"

    # Apply ingress
    if [ -f "08-ingress.yaml" ]; then
        kubectl apply -f 08-ingress.yaml
        echo -e "${GREEN}✓ Ingress configured${NC}"
    fi

    # Apply cert-manager if exists
    if [ -f "09-cert-manager.yaml" ]; then
        kubectl apply -f 09-cert-manager.yaml
        echo -e "${GREEN}✓ Certificate manager configured${NC}"
    fi

    cd "${SCRIPT_DIR}"
    echo ""
}

# Display summary
display_summary() {
    echo -e "${BLUE}[7/7] Setup Complete!${NC}"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Setup Summary                         ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}📁 Local Environment:${NC}"
    echo -e "   ✓ .env files created for all services"
    echo ""
    echo -e "${YELLOW}☸️  Kubernetes:${NC}"
    echo -e "   ✓ Secrets configured"
    echo -e "   Registry: registry.digitalocean.com/${DO_REGISTRY}"
    echo ""
    echo -e "${YELLOW}🌐 Domains:${NC}"
    echo -e "   • API: https://${API_DOMAIN}"
    echo -e "   • Location: https://${LOCATION_DOMAIN}"
    echo -e "   • Notifications: https://${NOTIFY_DOMAIN}"
    echo ""
    echo -e "${YELLOW}📊 Next Steps:${NC}"
    echo -e "   1. Configure DNS A records pointing to load balancer IP:"
    kubectl get ingress -n dropmate 2>/dev/null | grep -v NAME | awk '{print "      " $3 " → " $4}' || echo "      (Deploy to see IP)"
    echo ""
    echo -e "   2. Check deployment status:"
    echo -e "      ${BLUE}kubectl get pods -n dropmate${NC}"
    echo ""
    echo -e "   3. View logs:"
    echo -e "      ${BLUE}kubectl logs -n dropmate -l app=core-api --tail=50${NC}"
    echo ""
    echo -e "   4. Scale services:"
    echo -e "      ${BLUE}./scale-up.sh${NC}   - Scale to 4 replicas"
    echo -e "      ${BLUE}./scale-down.sh${NC} - Scale to 1 replica"
    echo ""
    echo -e "${GREEN}🎉 DropMate backend is ready!${NC}"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    gather_config
    create_local_env
    create_k8s_secrets
    build_and_push
    deploy_to_k8s
    display_summary
}

main
