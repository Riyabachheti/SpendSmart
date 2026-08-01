#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE="$PROJECT_ROOT/tests/fixtures/swiggy.jpeg"

echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test_user1@example.com", "password": "TestPass123!"}')

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "Login failed:"
  echo "$RESPONSE"
  exit 1
fi

echo "Got token."
echo ""

echo "Uploading receipt..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:8000/expenses/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FIXTURE")

echo "$UPLOAD_RESPONSE"
echo ""

EXPENSE_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expense_id',''))")

if [ -z "$EXPENSE_ID" ]; then
  echo "Upload failed — no expense_id returned."
  exit 1
fi

echo "Created expense_id=$EXPENSE_ID. Waiting 5 seconds for OCR to finish..."
sleep 5

echo ""
echo "Polling status:"
curl -s http://localhost:8000/expenses/$EXPENSE_ID -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
