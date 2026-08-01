#!/bin/bash
set -e

BASE="http://localhost:8000"

USER1_EMAIL="test_user1@example.com"
USER1_PASSWORD="TestPass123!"
USER2_EMAIL="test_user2@example.com"
USER2_PASSWORD="TestPass123!"

echo "== 0. Sign up both test users =="
curl -s -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER1_EMAIL\",\"password\":\"$USER1_PASSWORD\",\"full_name\":\"Test User One\"}" | jq .

curl -s -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER2_EMAIL\",\"password\":\"$USER2_PASSWORD\",\"full_name\":\"Test User Two\"}" | jq .

echo "== 1. Log in as User 1 =="
TOKEN1=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER1_EMAIL\",\"password\":\"$USER1_PASSWORD\"}" | jq -r .access_token)
echo "Token acquired: ${TOKEN1:0:20}..."

echo "== 2. GET /categories (expect 8 system defaults) =="
curl -s "$BASE/categories" -H "Authorization: Bearer $TOKEN1" | jq '. | length'

echo "== 3. POST /categories (custom category) =="
CAT_RESP=$(curl -s -X POST "$BASE/categories" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d '{"name":"Side Hustle","icon":"briefcase"}')
echo "$CAT_RESP" | jq .
CUSTOM_CAT_ID=$(echo "$CAT_RESP" | jq -r .id)

FOOD_CAT_ID=$(curl -s "$BASE/categories" -H "Authorization: Bearer $TOKEN1" \
  | jq -r '.[] | select(.name=="Food & Dining") | .id')

echo "== 4. POST /expenses (2-3 expenses) =="
EXP1=$(curl -s -X POST "$BASE/expenses" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d "{\"amount\":\"450.50\",\"expense_date\":\"2026-07-01\",\"category_id\":$FOOD_CAT_ID,\"merchant_name\":\"Swiggy\"}")
EXP1_ID=$(echo "$EXP1" | jq -r .id)

EXP2=$(curl -s -X POST "$BASE/expenses" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d "{\"amount\":\"1200.00\",\"expense_date\":\"2026-07-15\",\"category_id\":$CUSTOM_CAT_ID,\"merchant_name\":\"Domain renewal\"}")
EXP2_ID=$(echo "$EXP2" | jq -r .id)

echo "Created expense IDs: $EXP1_ID, $EXP2_ID"

echo "== 5. GET /expenses (all, most-recent-first) =="
curl -s "$BASE/expenses" -H "Authorization: Bearer $TOKEN1" | jq '[.items[] | {id, expense_date, merchant_name}]'

echo "== 6. GET /expenses?category_id=<custom> (only matching one) =="
curl -s "$BASE/expenses?category_id=$CUSTOM_CAT_ID" -H "Authorization: Bearer $TOKEN1" | jq '[.items[] | {id, merchant_name}]'

echo "== 7. PATCH /expenses/{id} (merchant_name only) =="
curl -s -X PATCH "$BASE/expenses/$EXP1_ID" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d '{"merchant_name":"Updated Merchant"}' | jq '{merchant_name, amount, expense_date}'

echo "== 8. POST /budgets (overall + category-specific) =="
BUDGET1=$(curl -s -X POST "$BASE/budgets" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d '{"amount":"20000","month":8,"year":2026}')
BUDGET1_ID=$(echo "$BUDGET1" | jq -r .id)
echo "Overall budget created: $BUDGET1_ID"

curl -s -X POST "$BASE/budgets" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d "{\"amount\":\"3000\",\"category_id\":$FOOD_CAT_ID,\"month\":8,\"year\":2026}" | jq '{id, amount, category_id}'

echo "== 9. POST /budgets AGAIN, same overall month (THE NULL-quirk test — expect 400) =="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE/budgets" \
  -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" \
  -d '{"amount":"25000","month":8,"year":2026}'

echo "== 10. Log in as User 2 =="
TOKEN2=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER2_EMAIL\",\"password\":\"$USER2_PASSWORD\"}" | jq -r .access_token)
echo "Token acquired: ${TOKEN2:0:20}..."

echo "== 11. User 2 attempts GET User 1's expense (expect 404) =="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "$BASE/expenses/$EXP1_ID" -H "Authorization: Bearer $TOKEN2"

echo "== 12. User 2 attempts DELETE User 1's custom category (expect 404) =="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE "$BASE/categories/$CUSTOM_CAT_ID" -H "Authorization: Bearer $TOKEN2"

echo "== 13. User 2 attempts PATCH User 1's budget (expect 404) =="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "$BASE/budgets/$BUDGET1_ID" \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d '{"amount":"1"}'

echo "== DONE =="
