#!/bin/bash
# Script to retrieve DigitalOcean Kubernetes node IP addresses

echo "========================================="
echo "DropMate Kubernetes Cluster - Node IPs"
echo "========================================="
echo ""

# Get cluster name from context
CLUSTER_NAME=$(kubectl config current-context | sed 's/do-.*-//')

echo "Cluster: dropmate-cluster"
echo "Namespace: dropmate"
echo ""

echo "--- Kubernetes Nodes ---"
kubectl get nodes -o wide

echo ""
echo "--- Node Internal IPs ---"
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.addresses[?(@.type=="InternalIP")].address}{"\n"}{end}'

echo ""
echo "--- Node External IPs (if available) ---"
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.addresses[?(@.type=="ExternalIP")].address}{"\n"}{end}'

echo ""
echo "--- Service LoadBalancer IPs ---"
kubectl get svc -n dropmate -o wide | grep LoadBalancer

echo ""
echo "--- Service External IPs ---"
echo "Core API: $(kubectl get svc core-api -n dropmate -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
echo "Location Service: $(kubectl get svc location-service -n dropmate -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
echo "Notification Service: $(kubectl get svc notification-service -n dropmate -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"

echo ""
echo "--- DigitalOcean Node Details (via doctl) ---"
if command -v doctl &> /dev/null; then
    doctl kubernetes cluster node-pool get dropmate-cluster dropmate-pool
else
    echo "doctl not found - install to see detailed node info"
fi
