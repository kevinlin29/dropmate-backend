#!/bin/bash

# Scale up core-api to 4 replicas
# Note: HPA will override this if CPU usage drops below threshold

echo "🚀 Scaling core-api to 4 replicas..."

# Option 1: Temporarily adjust HPA min replicas (recommended)
echo "Updating HPA minReplicas to 4..."
kubectl patch hpa core-api-hpa -n dropmate --type='json' -p='[{"op": "replace", "path": "/spec/minReplicas", "value": 4}]'

# Wait a moment for HPA to adjust
sleep 5

echo "✅ Current HPA status:"
kubectl get hpa core-api-hpa -n dropmate

echo ""
echo "✅ Current pod status:"
kubectl get pods -n dropmate -l app=core-api

echo ""
echo "📊 To monitor scaling progress, run:"
echo "   kubectl get pods -n dropmate -l app=core-api -w"
