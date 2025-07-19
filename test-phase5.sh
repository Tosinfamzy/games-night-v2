#!/bin/bash

echo "=== Phase 5 Enhanced Game Flow Testing ==="
echo

# Test basic connectivity
echo "1. Testing basic API connectivity..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/v1/)
echo "API Response Code: $response"
echo

# Check game library
echo "2. Checking game library..."
curl -s http://localhost:3000/v1/game-library | jq '.[0:2]' 2>/dev/null || echo "Game library check complete"
echo

# Create a games master
echo "3. Creating games master..."
gm_response=$(curl -s -X POST http://localhost:3000/v1/games-master \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Games Master",
    "email": "gm@test.com"
  }')
echo "Games Master: $gm_response"
gm_id=$(echo $gm_response | jq -r '.id' 2>/dev/null)
echo "Games Master ID: $gm_id"
echo

# Create a session
echo "4. Creating session..."
session_response=$(curl -s -X POST http://localhost:3000/v1/sessions \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Phase 5 Test Session\",
    \"gamesMasterId\": \"$gm_id\",
    \"maxPlayers\": 8
  }")
echo "Session: $session_response"
session_id=$(echo $session_response | jq -r '.id' 2>/dev/null)
echo "Session ID: $session_id"
echo

echo "=== Test script complete ==="
