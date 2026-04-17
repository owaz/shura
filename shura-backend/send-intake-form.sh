#!/bin/bash

# Quick script to send intake form to a client

if [ "$#" -ne 1 ]; then
    echo "Usage: ./send-intake-form.sh <user_id>"
    echo "Example: ./send-intake-form.sh 1"
    exit 1
fi

USER_ID=$1

echo "📋 Generating intake form link for User ID: $USER_ID"

curl -X POST http://localhost:5001/api/intake/generate-link \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER_ID}" \
  -s | jq .

echo ""
echo "✅ Check your email (shuraa.life@gmail.com) for the intake form link!"
