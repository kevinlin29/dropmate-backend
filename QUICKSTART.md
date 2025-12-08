# DropMate Backend - Quick Start Guide

## 🚀 Automated Setup & Deployment

This guide walks you through setting up and deploying the DropMate backend to DigitalOcean Kubernetes.

## Prerequisites

Before running the setup script, ensure you have:

### Required Tools
- **Docker** - [Install Docker](https://docs.docker.com/get-docker/)
- **kubectl** - [Install kubectl](https://kubernetes.io/docs/tasks/tools/)
- **doctl** (DigitalOcean CLI) - [Install doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/)

### Required Accounts & Services
- **DigitalOcean Account** with:
  - Kubernetes cluster created
  - Container Registry created
  - API token configured (`doctl auth init`)

- **Firebase Project** with:
  - Service account key downloaded
  - Authentication enabled

- **SendGrid Account** (for scaling alerts):
  - API key generated
  - Sender email verified

## 🎯 One-Command Setup

```bash
./setup.sh
```

The setup script will:
1. ✅ Check prerequisites
2. ✅ Gather configuration interactively
3. ✅ Create local `.env` files for all services
4. ✅ Generate Kubernetes secrets
5. ✅ Build and push Docker images to registry
6. ✅ Deploy to DigitalOcean Kubernetes
7. ✅ Display summary and next steps

## 📋 What You'll Be Asked

### DigitalOcean Configuration
- **Container Registry name** (e.g., `dropmate-1763357718`)
- **Kubernetes cluster name** (e.g., `dropmate-cluster`)
- **Region** (e.g., `nyc1`)

### Domain Configuration
- **Base domain** (e.g., `dropmate.ca`)
- **API subdomain** (e.g., `api.dropmate.ca`)
- **Location subdomain** (e.g., `location.dropmate.ca`)
- **Notification subdomain** (e.g., `notify.dropmate.ca`)

### Database Configuration
- **PostgreSQL username**
- **PostgreSQL password** (hidden input)
- **Database name**

### Redis Configuration
- **Redis password** (optional, leave empty for no auth)

### Authentication
- **JWT secret** (auto-generated if not provided)

### Firebase Configuration
- **Project ID**
- **Client email**
- **Private key** (paste entire key including BEGIN/END lines)

### SendGrid Configuration
- **API key**
- **Sender email** (must be verified in SendGrid)
- **Admin emails** (comma-separated list)

## 🎨 Interactive Mode

The script provides:
- **Default values** for common settings
- **Color-coded prompts** for clarity
- **Validation** of prerequisites
- **Confirmation prompts** before destructive operations

## 🔧 Manual Steps After Setup

### 1. Configure DNS Records

Point your domains to the LoadBalancer IP:

```bash
# Get the LoadBalancer IP
kubectl get ingress -n dropmate

# Add DNS A records:
# api.dropmate.ca      → <EXTERNAL-IP>
# location.dropmate.ca → <EXTERNAL-IP>
# notify.dropmate.ca   → <EXTERNAL-IP>
```

### 2. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n dropmate

# Check services
kubectl get svc -n dropmate

# Check HPA status
kubectl get hpa -n dropmate

# View logs
kubectl logs -n dropmate -l app=core-api --tail=50
```

### 3. Test Endpoints

```bash
# Health check
curl https://api.dropmate.ca/health

# Should return: {"status":"healthy","service":"core-api"}
```

## 🔄 Scaling Operations

After deployment, use these scripts:

```bash
# Scale up to 4 replicas (all services)
./scale-up.sh

# Scale down to 1 replica (cost savings)
./scale-down.sh

# Start Kubernetes dashboard
./start-dashboard.sh
```

## 📁 Generated Files

The setup script creates:

```
.env                              # Root environment file
services/core-api/.env            # Core API config
services/location-service/.env    # Location service config
services/notification-service/.env # Notification service config
services/scaling-monitor-service/.env # Scaling monitor config
k8s/digitalocean/01-secrets.yaml  # Kubernetes secrets (DO NOT COMMIT!)
```

## 🔒 Security Notes

**Important:** The following files contain sensitive data and are **automatically excluded** from git:
- All `.env` files
- `k8s/digitalocean/01-secrets.yaml`
- `*-firebase-adminsdk-*.json`
- `dashboard-token.txt`
- `kubectl` binary

## 🆘 Troubleshooting

### Setup fails at Docker build
```bash
# Check Docker is running
docker ps

# Login to DigitalOcean registry manually
doctl registry login
```

### Deployment fails
```bash
# Check cluster connection
kubectl cluster-info

# Reconnect to cluster
doctl kubernetes cluster kubeconfig save dropmate-cluster
```

### Pods not starting
```bash
# Check pod events
kubectl describe pod <pod-name> -n dropmate

# Check logs
kubectl logs <pod-name> -n dropmate

# Common issues:
# - Image pull errors: Check registry authentication
# - Database connection: Check PostgreSQL pod is ready
# - Missing secrets: Verify 01-secrets.yaml was applied
```

### SSL/TLS certificate issues
```bash
# Check cert-manager
kubectl get certificate -n dropmate

# Check certificate status
kubectl describe certificate <cert-name> -n dropmate

# Force renewal
kubectl delete certificate <cert-name> -n dropmate
kubectl apply -f k8s/digitalocean/09-cert-manager.yaml
```

## 🔄 Re-running Setup

You can safely re-run `./setup.sh` to:
- Update configuration
- Regenerate secrets
- Rebuild and redeploy services

**Note:** Existing data in PostgreSQL will be preserved.

## 📚 Additional Resources

- [Full Architecture Documentation](./docs/ARCHITECTURE.md)
- [Kubernetes Deployment Guide](./docs/KUBERNETES_DEPLOYMENT.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)

## 💡 Tips

1. **Use a password manager** for generated secrets
2. **Keep Firebase credentials secure** - never commit them
3. **Test locally first** with `docker-compose up`
4. **Monitor costs** on DigitalOcean dashboard
5. **Set up monitoring** (Prometheus/Grafana) for production

## 🎉 Success!

Once setup is complete, your DropMate backend will be:
- ✅ Running on Kubernetes
- ✅ Auto-scaling based on load
- ✅ Sending email alerts for scaling events
- ✅ Accessible via HTTPS with valid SSL certificates
- ✅ Ready for production traffic

---

**Need help?** Check the troubleshooting section or review the detailed documentation in `/docs`.
