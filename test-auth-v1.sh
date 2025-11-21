#!/bin/bash
echo "🧪 Testing Auth Endpoints (v1)"
echo "=============================="
echo ""

# Test 1: Signup
echo "1️⃣ Signup (Games Master)"
SIGNUP=$(curl -s -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"master@test.com","password":"Pass123!","name":"Master","role":"games_master"}')
echo "$SIGNUP" | jq -r '"\(.user.name) (\(.user.role)) - Token: \(.accessToken[:30])..."'
TOKEN=$(echo "$SIGNUP" | jq -r '.accessToken')
echo "✅ Signup successful"
echo ""

# Test 2: Login
echo "2️⃣ Login"
LOGIN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@test.com","password":"Pass123!"}')
echo "$LOGIN" | jq -r '"\(.user.name) logged in"'
echo "✅ Login successful"
echo ""

# Test 3: Get Me
echo "3️⃣ Get Current User (with token)"
ME=$(curl -s -X GET http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $TOKEN")
echo "$ME" | jq '.'
echo "✅ Get current user successful"
echo ""

# Test 4: Unauthorized
echo "4️⃣ Get Current User (without token - should fail)"
UNAUTH=$(curl -s -X GET http://localhost:3000/v1/auth/me)
echo "$UNAUTH" | jq '.'
if echo "$UNAUTH" | jq -e '.statusCode == 401' > /dev/null; then
  echo "✅ Properly rejected unauthorized request"
fi
echo ""

echo "✨ All tests passed!"
