#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE="$PROJECT_ROOT/tests/fixtures/swiggy.jpeg"

echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')
TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Got token."
echo ""

echo "Uploading Swiggy receipt (guaranteed 0.00 amount)..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:8000/expenses/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FIXTURE")
EXPENSE_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expense_id',''))")
echo "Created expense_id=$EXPENSE_ID. Waiting 5 seconds..."
sleep 5
echo ""

echo "Assigning category (but NOT fixing the amount)..."
curl -s -X PATCH http://localhost:8000/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category_id": 1}' > /dev/null

echo "Attempting confirm with amount still 0.00 (expect 400 now):"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:8000/expenses/$EXPENSE_ID/confirm -H "Authorization: Bearer $TOKEN"
echo ""
echo ""

echo "Now fixing the amount via PATCH..."
curl -s -X PATCH http://localhost:8000/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount": 250.00}' > /dev/null

echo "Confirming again (expect success now):"
curl -s -X POST http://localhost:8000/expenses/$EXPENSE_ID/confirm -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
