#!/bin/bash

echo "🚀 Starting Kubernetes Dashboard..."
echo ""
echo "📋 Access Token (valid for 24 hours):"
echo "=================================="
cat dashboard-token.txt
echo ""
echo "=================================="
echo ""
echo "🌐 Starting kubectl proxy..."
echo ""
echo "Dashboard will be available at:"
echo "http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
echo ""
echo "📝 Instructions:"
echo "1. Open the URL above in your browser"
echo "2. Select 'Token' authentication"
echo "3. Paste the token shown above"
echo "4. Click 'Sign In'"
echo ""
echo "Press Ctrl+C to stop the proxy"
echo ""

kubectl proxy
