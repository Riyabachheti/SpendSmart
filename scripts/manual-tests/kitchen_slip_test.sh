#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE="$PROJECT_ROOT/tests/fixtures/kitchen_order_slip.jpg"

echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')
TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Got token."
echo ""

echo "Uploading Kitchen Order Slip..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:8000/expenses/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FIXTURE")
echo "$UPLOAD_RESPONSE"

EXPENSE_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expense_id',''))")
echo "Created expense_id=$EXPENSE_ID. Waiting 5 seconds..."
sleep 5
echo ""

echo "Polling parsed result:"
curl -s http://localhost:8000/expenses/$EXPENSE_ID -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "Assigning a category and confirming..."
curl -s -X PATCH http://localhost:8000/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"category_id": 1}' > /dev/null

curl -s -X POST http://localhost:8000/expenses/$EXPENSE_ID/confirm -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
