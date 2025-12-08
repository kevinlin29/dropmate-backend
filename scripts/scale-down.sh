#!/bin/bash

# Scale down core-api to 1 replica
# Note: This sets minReplicas to 1, HPA will maintain at least 1 replica

echo "📉 Scaling core-api down to 1 replica..."

# Update HPA minReplicas to 1
echo "Updating HPA minReplicas to 1..."
kubectl patch hpa core-api-hpa -n dropmate --type='json' -p='[{"op": "replace", "path": "/spec/minReplicas", "value": 1}]'

# Wait a moment for HPA to adjust
sleep 5

echo "✅ Current HPA status:"
kubectl get hpa core-api-hpa -n dropmate

echo ""
echo "✅ Current pod status:"
kubectl get pods -n dropmate -l app=core-api

echo ""
echo "⚠️  Note: HPA may keep more than 1 replica if CPU usage is high"
echo "📊 To monitor scaling progress, run:"
echo "   kubectl get pods -n dropmate -l app=core-api -w"
