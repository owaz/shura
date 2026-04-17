#!/usr/bin/env bash
# e2e-login.sh - non-interactive script to create dev users/admins and test key endpoints
set -euo pipefail
BACKEND=${BACKEND:-http://localhost:5001}

echo "Creating dev client..."
client_html=$(curl -sS -L "$BACKEND/api/dev/login")
client_token=$(echo "$client_html" | sed -n "s/.*localStorage.setItem('shura-auth-token', '\\(.*\\)'.*/\1/p" | tr -d "'\n")
if [ -z "$client_token" ]; then
  client_token=$(echo "$client_html" | sed -n 's/.*localStorage.setItem("shura-auth-token", "\(.*\)");.*/\1/p' | tr -d '"\n')
fi
if [ -z "$client_token" ]; then
  echo "Failed to extract client token" >&2
  exit 2
fi

echo "Client token obtained: ${client_token:0:8}..."

echo "Calling /api/auth/profile with client token..."
curl -sS -i -H "Authorization: Bearer $client_token" "$BACKEND/api/auth/profile" || true

echo -e "\nCreating dev admin..."
admin_html=$(curl -sS -L "$BACKEND/api/dev/admin-login")
admin_token=$(echo "$admin_html" | sed -n "s/.*localStorage.setItem('adminToken', '\\(.*\\)'.*/\1/p" | tr -d "'\n")
if [ -z "$admin_token" ]; then
  admin_token=$(echo "$admin_html" | sed -n 's/.*localStorage.setItem("adminToken", "\(.*\)");.*/\1/p' | tr -d '"\n')
fi
if [ -z "$admin_token" ]; then
  echo "Failed to extract admin token" >&2
  exit 3
fi

echo "Admin token obtained: ${admin_token:0:8}..."

echo "Calling /api/admin/auth/profile with admin token..."
curl -sS -i -H "Authorization: Bearer $admin_token" "$BACKEND/api/admin/auth/profile" || true

echo -e "\nCalling protected /api/admin/auth/stats with admin token..."
curl -sS -i -H "Authorization: Bearer $admin_token" "$BACKEND/api/admin/auth/stats" || true

echo -e "\nDone."