#!/bin/bash

echo "🚀 Starting Kubernetes Dashboard..."
echo ""
echo "🔐 Generating new access token..."

# Generate fresh token (valid for 24 hours)
TOKEN=$(kubectl create token admin-user -n kubernetes-dashboard --duration=24h)

# Save to file
echo "$TOKEN" > dashboard-token.txt

echo "✅ Token generated and saved to dashboard-token.txt"
echo ""
echo "📋 Access Token (valid for 24 hours):"
echo "=================================="
echo "$TOKEN"
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
