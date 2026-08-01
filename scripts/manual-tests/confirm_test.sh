#!/bin/bash

EXPENSE_ID=4

echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')
TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Got token."
echo ""

echo "Attempting confirm WITHOUT a category (expect 400):"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:8000/expenses/$EXPENSE_ID/confirm -H "Authorization: Bearer $TOKEN"
echo ""

echo "Available categories:"
curl -s http://localhost:8000/categories -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "Assigning category_id=1:"
curl -s -X PATCH http://localhost:8000/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category_id": 1}' | python3 -m json.tool
echo ""

echo "Confirming now (expect is_verified: true):"
curl -s -X POST http://localhost:8000/expenses/$EXPENSE_ID/confirm -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "Checking pending-review list (expense $EXPENSE_ID should be GONE from this):"
curl -s http://localhost:8000/expenses/pending-review -H "Authorization: Bearer $TOKEN" | python3 -m json.tool