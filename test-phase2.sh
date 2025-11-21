#!/bin/bash

# Phase 2 Authentication Testing Script
# Tests session endpoint protection and hybrid authentication

BASE_URL="http://localhost:3000/v1"
echo "🧪 Phase 2 Authentication Tests"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Create GM account and get token
echo -e "${BLUE}Test 1: Create Games Master account${NC}"
GM_SIGNUP_RESPONSE=$(curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gm-phase2@example.com",
    "password": "SecurePass123!",
    "name": "Test Games Master",
    "role": "games_master"
  }')

GM_TOKEN=$(echo $GM_SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')
GM_PROFILE_ID=$(echo $GM_SIGNUP_RESPONSE | grep -o '"gamesMasterId":"[^"]*' | sed 's/"gamesMasterId":"//')

if [ -n "$GM_TOKEN" ]; then
  echo -e "${GREEN}✓ Games Master created successfully${NC}"
  echo "  Token: ${GM_TOKEN:0:20}..."
  echo "  Profile ID: $GM_PROFILE_ID"
else
  echo -e "${RED}✗ Failed to create Games Master${NC}"
  echo "Response: $GM_SIGNUP_RESPONSE"
fi
echo ""

# Test 2: Create session (should require auth)
echo -e "${BLUE}Test 2: Create session WITHOUT auth (should fail)${NC}"
UNAUTH_SESSION_RESPONSE=$(curl -s -X POST $BASE_URL/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Game Night",
    "gamesMasterId": "'$GM_PROFILE_ID'",
    "maxPlayers": 8,
    "date": "2024-12-31T19:00:00Z"
  }')

if echo "$UNAUTH_SESSION_RESPONSE" | grep -q "Unauthorized"; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated request${NC}"
else
  echo -e "${RED}✗ Should have rejected request${NC}"
  echo "Response: $UNAUTH_SESSION_RESPONSE"
fi
echo ""

# Test 3: Create session WITH auth (should succeed)
echo -e "${BLUE}Test 3: Create session WITH auth (should succeed)${NC}"
AUTH_SESSION_RESPONSE=$(curl -s -X POST $BASE_URL/sessions \
  -H "Authorization: Bearer $GM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Authenticated Game Night",
    "gamesMasterId": "'$GM_PROFILE_ID'",
    "maxPlayers": 8,
    "date": "2024-12-31T19:00:00Z"
  }')

SESSION_ID=$(echo $AUTH_SESSION_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
JOIN_CODE=$(echo $AUTH_SESSION_RESPONSE | grep -o '"joinCode":"[^"]*' | sed 's/"joinCode":"//')

if [ -n "$SESSION_ID" ]; then
  echo -e "${GREEN}✓ Session created successfully${NC}"
  echo "  Session ID: $SESSION_ID"
  echo "  Join Code: $JOIN_CODE"
else
  echo -e "${RED}✗ Failed to create session${NC}"
  echo "Response: $AUTH_SESSION_RESPONSE"
fi
echo ""

# Test 4: Create player account
echo -e "${BLUE}Test 4: Create Player account${NC}"
PLAYER_SIGNUP_RESPONSE=$(curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player-phase2@example.com",
    "password": "PlayerPass123!",
    "name": "Test Player",
    "role": "player"
  }')

PLAYER_TOKEN=$(echo $PLAYER_SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -n "$PLAYER_TOKEN" ]; then
  echo -e "${GREEN}✓ Player account created successfully${NC}"
  echo "  Token: ${PLAYER_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Failed to create player${NC}"
  echo "Response: $PLAYER_SIGNUP_RESPONSE"
fi
echo ""

# Test 5: Guest player join (no auth)
echo -e "${BLUE}Test 5: Guest player join WITHOUT auth${NC}"
GUEST_JOIN_RESPONSE=$(curl -s -X POST $BASE_URL/sessions/join \
  -H "Content-Type: application/json" \
  -d '{
    "joinCode": "'$JOIN_CODE'",
    "playerName": "Guest Player"
  }')

GUEST_PLAYER_ID=$(echo $GUEST_JOIN_RESPONSE | grep -o '"playerId":"[^"]*' | sed 's/"playerId":"//')

if [ -n "$GUEST_PLAYER_ID" ]; then
  echo -e "${GREEN}✓ Guest player joined successfully${NC}"
  echo "  Player ID: $GUEST_PLAYER_ID"
else
  echo -e "${RED}✗ Failed guest join${NC}"
  echo "Response: $GUEST_JOIN_RESPONSE"
fi
echo ""

# Test 6: Authenticated player join
echo -e "${BLUE}Test 6: Authenticated player join WITH auth${NC}"
AUTH_JOIN_RESPONSE=$(curl -s -X POST $BASE_URL/sessions/join \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "joinCode": "'$JOIN_CODE'",
    "playerName": "Authenticated Player"
  }')

AUTH_PLAYER_ID=$(echo $AUTH_JOIN_RESPONSE | grep -o '"playerId":"[^"]*' | sed 's/"playerId":"//')

if [ -n "$AUTH_PLAYER_ID" ]; then
  echo -e "${GREEN}✓ Authenticated player joined successfully${NC}"
  echo "  Player ID: $AUTH_PLAYER_ID"
else
  echo -e "${RED}✗ Failed authenticated join${NC}"
  echo "Response: $AUTH_JOIN_RESPONSE"
fi
echo ""

# Test 7: Update session without auth (should fail)
echo -e "${BLUE}Test 7: Update session WITHOUT auth (should fail)${NC}"
UNAUTH_UPDATE_RESPONSE=$(curl -s -X PUT $BASE_URL/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name"
  }')

if echo "$UNAUTH_UPDATE_RESPONSE" | grep -q "Unauthorized"; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated update${NC}"
else
  echo -e "${RED}✗ Should have rejected request${NC}"
  echo "Response: $UNAUTH_UPDATE_RESPONSE"
fi
echo ""

# Test 8: Update session with auth (should succeed)
echo -e "${BLUE}Test 8: Update session WITH auth (should succeed)${NC}"
AUTH_UPDATE_RESPONSE=$(curl -s -X PUT $BASE_URL/sessions/$SESSION_ID \
  -H "Authorization: Bearer $GM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Game Night"
  }')

if echo "$AUTH_UPDATE_RESPONSE" | grep -q "Updated Game Night"; then
  echo -e "${GREEN}✓ Session updated successfully${NC}"
else
  echo -e "${RED}✗ Failed to update session${NC}"
  echo "Response: $AUTH_UPDATE_RESPONSE"
fi
echo ""

# Test 9: Create another GM to test ownership
echo -e "${BLUE}Test 9: Create another GM and try to modify first GM's session${NC}"
OTHER_GM_SIGNUP=$(curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "other-gm@example.com",
    "password": "OtherPass123!",
    "name": "Other GM",
    "role": "games_master"
  }')

OTHER_GM_TOKEN=$(echo $OTHER_GM_SIGNUP | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -n "$OTHER_GM_TOKEN" ]; then
  echo -e "${GREEN}✓ Other GM created${NC}"
  
  # Try to update first GM's session
  echo -e "${BLUE}   Attempting to update another GM's session...${NC}"
  WRONG_OWNER_RESPONSE=$(curl -s -X PUT $BASE_URL/sessions/$SESSION_ID \
    -H "Authorization: Bearer $OTHER_GM_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Hacked Session"
    }')
  
  if echo "$WRONG_OWNER_RESPONSE" | grep -q "Forbidden"; then
    echo -e "${GREEN}✓ Correctly rejected unauthorized owner${NC}"
  else
    echo -e "${RED}✗ Should have rejected ownership violation${NC}"
    echo "Response: $WRONG_OWNER_RESPONSE"
  fi
fi
echo ""

# Test 10: Delete session without auth (should fail)
echo -e "${BLUE}Test 10: Delete session WITHOUT auth (should fail)${NC}"
UNAUTH_DELETE_RESPONSE=$(curl -s -X DELETE $BASE_URL/sessions/$SESSION_ID)

if echo "$UNAUTH_DELETE_RESPONSE" | grep -q "Unauthorized"; then
  echo -e "${GREEN}✓ Correctly rejected unauthenticated delete${NC}"
else
  echo -e "${RED}✗ Should have rejected request${NC}"
  echo "Response: $UNAUTH_DELETE_RESPONSE"
fi
echo ""

# Test 11: Public endpoints still work (no auth required)
echo -e "${BLUE}Test 11: Public endpoints accessible WITHOUT auth${NC}"
PUBLIC_SESSIONS_RESPONSE=$(curl -s -X GET $BASE_URL/sessions)

if echo "$PUBLIC_SESSIONS_RESPONSE" | grep -q "$SESSION_ID"; then
  echo -e "${GREEN}✓ Public GET /sessions works without auth${NC}"
else
  echo -e "${RED}✗ Public endpoint failed${NC}"
  echo "Response: $PUBLIC_SESSIONS_RESPONSE"
fi
echo ""

echo "================================="
echo -e "${BLUE}Phase 2 Testing Complete!${NC}"
echo "================================="
