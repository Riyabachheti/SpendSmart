#!/bin/bash

echo "Logging in as user 1 (owner of expense 4)..."
R1=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')
TOKEN1=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Got token for user 1."
echo ""

echo "Creating a second user..."
curl -s -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user2@example.com", "password": "TestPass123!"}'
echo ""

echo "Logging in as user 2..."
R2=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user2@example.com", "password": "TestPass123!"}')
TOKEN2=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Got token for user 2."
echo ""

echo "User 2 attempting to GET user 1's expense (id=4) — expect 404, not the actual data:"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:8000/expenses/4 -H "Authorization: Bearer $TOKEN2"
echo ""

echo "User 2 attempting to PATCH user 1's expense — expect 404:"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH http://localhost:8000/expenses/4 \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d '{"category_id": 1}'
echo ""

echo "User 2 attempting to confirm user 1's expense — expect 404:"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:8000/expenses/4/confirm -H "Authorization: Bearer $TOKEN2"
echo ""

echo "User 2's own pending-review list (expect empty or only user 2's own items, definitely NOT expense 4):"
curl -s http://localhost:8000/expenses/pending-review -H "Authorization: Bearer $TOKEN2" | python3 -m json.tool