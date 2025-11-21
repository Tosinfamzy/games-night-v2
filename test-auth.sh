#!/bin/bash

# Test Authentication Endpoints
echo "🧪 Testing Authentication Endpoints"
echo "===================================="
echo ""

# Test 1: Signup
echo "1️⃣  Testing Signup (Games Master)"
echo "---"
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testgm@games.com",
    "password": "SecurePass123!",
    "name": "Test Game Master",
    "role": "games_master"
  }')

echo "$SIGNUP_RESPONSE" | jq '.'

# Extract access token
ACCESS_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.accessToken')
REFRESH_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.refreshToken')
USER_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.user.id')

if [ "$ACCESS_TOKEN" != "null" ] && [ "$ACCESS_TOKEN" != "" ]; then
  echo "✅ Signup successful! Token received."
else
  echo "❌ Signup failed!"
  exit 1
fi

echo ""
echo "2️⃣  Testing Login"
echo "---"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testgm@games.com",
    "password": "SecurePass123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

NEW_ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ "$NEW_ACCESS_TOKEN" != "" ]; then
  echo "✅ Login successful!"
else
  echo "❌ Login failed!"
  exit 1
fi

echo ""
echo "3️⃣  Testing /auth/me (Get Current User)"
echo "---"
ME_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$ME_RESPONSE" | jq '.'

if echo "$ME_RESPONSE" | jq -e '.id' > /dev/null; then
  echo "✅ Get current user successful!"
else
  echo "❌ Get current user failed!"
fi

echo ""
echo "4️⃣  Testing /auth/me without token (should fail)"
echo "---"
UNAUTH_RESPONSE=$(curl -s -X GET http://localhost:3000/auth/me)
echo "$UNAUTH_RESPONSE" | jq '.'

if echo "$UNAUTH_RESPONSE" | jq -e '.statusCode' | grep -q "401"; then
  echo "✅ Unauthorized request properly rejected!"
else
  echo "⚠️  Expected 401 status"
fi

echo ""
echo "5️⃣  Testing Token Refresh"
echo "---"
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "$REFRESH_RESPONSE" | jq '.'

REFRESHED_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken')

if [ "$REFRESHED_TOKEN" != "null" ] && [ "$REFRESHED_TOKEN" != "" ]; then
  echo "✅ Token refresh successful!"
else
  echo "❌ Token refresh failed!"
fi

echo ""
echo "6️⃣  Testing Signup (Player)"
echo "---"
PLAYER_SIGNUP=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@games.com",
    "password": "PlayerPass123!",
    "name": "Test Player",
    "role": "player"
  }')

echo "$PLAYER_SIGNUP" | jq '.'

PLAYER_TOKEN=$(echo "$PLAYER_SIGNUP" | jq -r '.accessToken')

if [ "$PLAYER_TOKEN" != "null" ] && [ "$PLAYER_TOKEN" != "" ]; then
  echo "✅ Player signup successful!"
else
  echo "❌ Player signup failed!"
fi

echo ""
echo "7️⃣  Testing Invalid Login"
echo "---"
INVALID_LOGIN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testgm@games.com",
    "password": "WrongPassword123!"
  }')

echo "$INVALID_LOGIN" | jq '.'

if echo "$INVALID_LOGIN" | jq -e '.statusCode' | grep -q "401"; then
  echo "✅ Invalid credentials properly rejected!"
else
  echo "⚠️  Expected 401 status"
fi

echo ""
echo "================================"
echo "✨ All Tests Completed!"
echo "================================"
echo ""
echo "📝 Summary:"
echo "  - Access Token: ${ACCESS_TOKEN:0:20}..."
echo "  - User ID: $USER_ID"
echo "  - Refresh Token: ${REFRESH_TOKEN:0:20}..."
