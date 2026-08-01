#!/bin/bash

echo "Signing up (ok if this fails because the account already exists):"
curl -s -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}'
echo ""
echo ""

echo "Logging in:"
RESPONSE=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')

echo "$RESPONSE"
echo ""

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "TOKEN=$TOKEN"