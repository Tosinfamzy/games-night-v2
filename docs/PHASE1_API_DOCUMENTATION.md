# Phase 1 API Documentation

Complete guide for integrating Phase 1 features into the frontend UI.

## Table of Contents
1. [WebSocket Namespaces](#websocket-namespaces)
2. [Chat System](#chat-system)
3. [Player Online Tracking](#player-online-tracking)
4. [Timer System](#timer-system)
5. [Games Master Dashboard](#games-master-dashboard)
6. [Authentication](#authentication)
7. [Error Handling](#error-handling)

---

## WebSocket Namespaces

### Connection Setup

The backend exposes three Socket.IO namespaces:

| Namespace | Purpose | Required Query Params |
|-----------|---------|----------------------|
| `/sessions` | Session & player state management | `playerId` |
| `/games` | Game state & turn management | None (manual join) |
| `/chat` | Real-time messaging | `playerId` |

### Connection Example

```typescript
import io from 'socket.io-client';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Connect to sessions namespace
const sessionSocket = io(`${baseURL}/sessions`, {
  query: { playerId: currentPlayer.id }
});

// Connect to chat namespace
const chatSocket = io(`${baseURL}/chat`, {
  query: { playerId: currentPlayer.id }
});

// Connect to games namespace
const gameSocket = io(`${baseURL}/games`);
```

---

## Chat System

### Overview
Real-time session-wide chat with message persistence and history.

### WebSocket Events

#### Client → Server

**1. Send Message**
```typescript
chatSocket.emit('send-message', {
  content: string;        // 1-1000 characters
  sessionId: string;      // UUID
  playerId: string;       // UUID
});
```

**Example:**
```typescript
chatSocket.emit('send-message', {
  content: 'Hello everyone!',
  sessionId: 'session-123',
  playerId: 'player-456'
});
```

**2. Load History**
```typescript
chatSocket.emit('load-history', {
  sessionId: string;           // UUID
  limit?: number;              // 1-100, default: 50
  beforeMessageId?: string;    // UUID for pagination
});
```

**Example - Initial Load:**
```typescript
chatSocket.emit('load-history', {
  sessionId: 'session-123',
  limit: 50
});
```

**Example - Load More (Pagination):**
```typescript
chatSocket.emit('load-history', {
  sessionId: 'session-123',
  limit: 50,
  beforeMessageId: 'oldest-message-id-in-current-view'
});
```

**3. Join Chat Room**
```typescript
chatSocket.emit('join-chat', {
  sessionId: string;
  playerId: string;
});
```
*Note: Auto-joined on connection, but can explicitly join*

**4. Leave Chat Room**
```typescript
chatSocket.emit('leave-chat', {
  sessionId: string;
  playerId: string;
});
```

#### Server → Client

**1. Message Sent**
```typescript
chatSocket.on('chat:message-sent', (data) => {
  message: {
    id: string;
    content: string;
    sessionId: string;
    playerId: string;
    playerName: string;
    type: 'text' | 'system';
    isEdited: boolean;
    createdAt: Date;
  };
  timestamp: string; // ISO 8601
});
```

**2. History Loaded**
```typescript
chatSocket.on('chat:history-loaded', (data) => {
  messages: Array<{
    id: string;
    content: string;
    sessionId: string;
    playerId: string;
    playerName: string;
    type: 'text' | 'system';
    isEdited: boolean;
    createdAt: Date;
  }>;
  hasMore: boolean;  // True if more messages exist
  timestamp: string; // ISO 8601
});
```

**3. Error**
```typescript
chatSocket.on('chat:error', (data) => {
  error: string;
  code: string; // e.g., 'NotFoundException', 'ForbiddenException'
});
```

### Frontend Implementation Example

```typescript
// Chat Component
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Message {
  id: string;
  content: string;
  playerName: string;
  createdAt: Date;
}

function ChatComponent({ sessionId, playerId }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to chat
    const chatSocket = io(`${process.env.REACT_APP_API_URL}/chat`, {
      query: { playerId }
    });

    // Listen for new messages
    chatSocket.on('chat:message-sent', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for history
    chatSocket.on('chat:history-loaded', ({ messages, hasMore }) => {
      setMessages(messages.reverse()); // Server sends newest first
      setHasMore(hasMore);
    });

    // Handle errors
    chatSocket.on('chat:error', ({ error }) => {
      console.error('Chat error:', error);
      // Show error notification to user
    });

    // Load initial history
    chatSocket.emit('load-history', {
      sessionId,
      limit: 50
    });

    setSocket(chatSocket);

    return () => {
      chatSocket.disconnect();
    };
  }, [sessionId, playerId]);

  const sendMessage = () => {
    if (!inputValue.trim() || !socket) return;

    socket.emit('send-message', {
      content: inputValue,
      sessionId,
      playerId
    });

    setInputValue('');
  };

  const loadMore = () => {
    if (!hasMore || !socket) return;

    const oldestMessageId = messages[0]?.id;
    socket.emit('load-history', {
      sessionId,
      limit: 50,
      beforeMessageId: oldestMessageId
    });
  };

  return (
    <div className="chat-container">
      {hasMore && (
        <button onClick={loadMore}>Load older messages</button>
      )}

      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <strong>{msg.playerName}:</strong> {msg.content}
            <small>{new Date(msg.createdAt).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          maxLength={1000}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

---

## Player Online Tracking

### Overview
Real-time tracking of player connection status in sessions.

### WebSocket Events (Sessions Namespace)

#### Server → Client

**1. Player Online**
```typescript
sessionSocket.on('session:player-online', (data) => {
  sessionId: string;
  playerId: string;
  playerName: string;
  timestamp: string; // ISO 8601
});
```

**2. Player Offline**
```typescript
sessionSocket.on('session:player-offline', (data) => {
  sessionId: string;
  playerId: string;
  playerName: string;
  timestamp: string; // ISO 8601
});
```

### Player Entity Update

Players now have these additional fields:

```typescript
interface Player {
  // ... existing fields
  isOnline: boolean;              // WebSocket connection status
  currentSocketId?: string;       // Current socket connection ID
  lastConnectedAt?: Date;         // Last connection timestamp
}
```

### REST API

**Get Session Players (includes online status)**
```
GET /players/session/:sessionId
```

**Response:**
```json
[
  {
    "id": "player-123",
    "name": "Alice",
    "isOnline": true,
    "status": "READY",
    "lastConnectedAt": "2025-01-24T10:30:00Z"
  }
]
```

### Frontend Implementation Example

```typescript
// PlayerList Component
function PlayerList({ sessionId }) {
  const [players, setPlayers] = useState([]);
  const socket = useSessionSocket();

  useEffect(() => {
    // Fetch initial player list
    fetch(`/api/players/session/${sessionId}`)
      .then(res => res.json())
      .then(setPlayers);

    // Listen for online status changes
    socket.on('session:player-online', ({ playerId, playerName }) => {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, isOnline: true } : p
      ));
      // Show notification: "{playerName} is online"
    });

    socket.on('session:player-offline', ({ playerId, playerName }) => {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, isOnline: false } : p
      ));
      // Show notification: "{playerName} went offline"
    });

    return () => {
      socket.off('session:player-online');
      socket.off('session:player-offline');
    };
  }, [sessionId]);

  return (
    <ul className="player-list">
      {players.map(player => (
        <li key={player.id}>
          <span className={`status-dot ${player.isOnline ? 'online' : 'offline'}`} />
          {player.name}
          {player.isOnline && <span className="badge">Online</span>}
        </li>
      ))}
    </ul>
  );
}
```

---

## Timer System

### Overview
Turn-based timer with auto-advance on timeout.

### Game Entity Update

Games now include timer fields:

```typescript
interface Game {
  // ... existing fields
  turnTimeLimit?: number;      // Seconds per turn (null = no limit)
  turnStartedAt?: Date;        // When current turn started
  turnEndsAt?: Date;          // When current turn will end (calculated)
}
```

### WebSocket Events (Games Namespace)

#### Client → Server

**Start Game with Timer**
```typescript
POST /games/:gameId/start
{
  "turnTimeLimit": 60  // Optional: seconds per turn
}
```

#### Server → Client

**1. Turn Started**
```typescript
gameSocket.on('game:turn-started', (data) => {
  gameId: string;
  teamId: string;
  teamName: string;
  turnTimeLimit: number | null;  // Seconds
  turnStartedAt: string;         // ISO 8601
  turnEndsAt: string | null;     // ISO 8601 or null if no limit
  timestamp: string;
});
```

**2. Turn Advanced (Manual or Auto)**
```typescript
gameSocket.on('game:turn-advanced', (data) => {
  gameId: string;
  previousTeamId: string;
  nextTeamId: string;
  nextTeamName: string;
  turnTimeLimit: number | null;
  turnStartedAt: string;
  turnEndsAt: string | null;
  autoAdvanced: boolean;  // True if timeout triggered auto-advance
  timestamp: string;
});
```

**3. Timer Tick (every second)**
```typescript
gameSocket.on('game:timer-tick', (data) => {
  gameId: string;
  timeRemaining: number;  // Seconds remaining
  timestamp: string;
});
```

**4. Timer Expired**
```typescript
gameSocket.on('game:timer-expired', (data) => {
  gameId: string;
  teamId: string;
  teamName: string;
  timestamp: string;
});
```

### Frontend Implementation Example

```typescript
// TimerDisplay Component
function TimerDisplay({ gameId, currentTurnTeamId }) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const socket = useGameSocket();

  useEffect(() => {
    socket.on('game:timer-tick', ({ gameId: tickGameId, timeRemaining }) => {
      if (tickGameId === gameId) {
        setTimeRemaining(timeRemaining);
      }
    });

    socket.on('game:turn-started', ({ turnTimeLimit, turnEndsAt }) => {
      if (turnTimeLimit) {
        const remaining = Math.floor(
          (new Date(turnEndsAt).getTime() - Date.now()) / 1000
        );
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(null); // No time limit
      }
    });

    socket.on('game:turn-advanced', ({ turnTimeLimit, turnEndsAt, autoAdvanced }) => {
      if (autoAdvanced) {
        // Show notification: "Time's up! Turn auto-advanced"
      }

      if (turnTimeLimit) {
        const remaining = Math.floor(
          (new Date(turnEndsAt).getTime() - Date.now()) / 1000
        );
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(null);
      }
    });

    socket.on('game:timer-expired', ({ teamName }) => {
      // Show notification: "Time's up for {teamName}!"
      setTimeRemaining(0);
    });

    return () => {
      socket.off('game:timer-tick');
      socket.off('game:turn-started');
      socket.off('game:turn-advanced');
      socket.off('game:timer-expired');
    };
  }, [gameId]);

  if (timeRemaining === null) {
    return <div>No time limit</div>;
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLowTime = timeRemaining <= 10;

  return (
    <div className={`timer ${isLowTime ? 'timer-warning' : ''}`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}
```

---

## Games Master Dashboard

### Overview
Real-time dashboard for Games Masters to monitor and control sessions.

### REST API

**Get Dashboard**
```
GET /games-masters/:id/dashboard
```

**Response:**
```json
{
  "gamesMasterId": "gm-123",
  "gamesMasterName": "John Doe",
  "stats": {
    "totalSessions": 10,
    "activeSessions": 2,
    "totalPlayers": 45,
    "onlinePlayers": 12,
    "totalGames": 30,
    "gamesInProgress": 3,
    "gamesCompleted": 27
  },
  "sessions": [
    {
      "id": "session-123",
      "name": "Friday Game Night",
      "status": "IN_PROGRESS",
      "location": "Main Hall",
      "scheduledFor": "2025-01-24T19:00:00Z",
      "playersCount": 8,
      "players": [
        {
          "id": "player-1",
          "name": "Alice",
          "avatarUrl": null,
          "isOnline": true,
          "teamId": "team-1",
          "teamName": "Team A"
        }
      ],
      "games": [
        {
          "id": "game-1",
          "name": "Trivia Round 1",
          "status": "IN_PROGRESS",
          "currentRound": 2,
          "maxRounds": 5,
          "teamsCount": 2,
          "currentTurnTeamId": "team-1",
          "currentTurnTeamName": "Team A",
          "turnStartedAt": "2025-01-24T19:15:00Z",
          "turnTimeLimit": 60,
          "winnerId": null,
          "createdAt": "2025-01-24T19:00:00Z"
        }
      ],
      "gamesInProgress": 1,
      "gamesCompleted": 0
    }
  ],
  "lastUpdated": "2025-01-24T19:20:00Z"
}
```

### WebSocket Events (Sessions Namespace)

All session state changes are broadcast to connected clients:

- `session:status-changed` - Session status updated
- `session:player-joined` - New player joined
- `session:player-left` - Player left
- `session:player-ready-changed` - Player ready status changed
- `session:readiness-changed` - Overall session readiness changed
- `session:can-start-changed` - Session can/cannot start
- `session:team-created` - New team created
- `session:player-assigned-to-team` - Player assigned to team
- `session:player-online` - Player came online
- `session:player-offline` - Player went offline

### Frontend Implementation Example

```typescript
// GMDashboard Component
function GMDashboard({ gamesMasterId }) {
  const [dashboard, setDashboard] = useState(null);
  const socket = useSessionSocket();

  useEffect(() => {
    // Fetch initial dashboard
    fetch(`/api/games-masters/${gamesMasterId}/dashboard`)
      .then(res => res.json())
      .then(setDashboard);

    // Refresh dashboard on any session event
    const refreshDashboard = () => {
      fetch(`/api/games-masters/${gamesMasterId}/dashboard`)
        .then(res => res.json())
        .then(setDashboard);
    };

    socket.on('session:status-changed', refreshDashboard);
    socket.on('session:player-joined', refreshDashboard);
    socket.on('session:player-left', refreshDashboard);
    socket.on('session:player-online', refreshDashboard);
    socket.on('session:player-offline', refreshDashboard);

    return () => {
      socket.off('session:status-changed');
      socket.off('session:player-joined');
      socket.off('session:player-left');
      socket.off('session:player-online');
      socket.off('session:player-offline');
    };
  }, [gamesMasterId]);

  if (!dashboard) return <div>Loading...</div>;

  return (
    <div className="gm-dashboard">
      <h1>Games Master Dashboard</h1>

      <div className="stats-grid">
        <StatCard label="Active Sessions" value={dashboard.stats.activeSessions} />
        <StatCard label="Online Players" value={dashboard.stats.onlinePlayers} />
        <StatCard label="Games in Progress" value={dashboard.stats.gamesInProgress} />
        <StatCard label="Games Completed" value={dashboard.stats.gamesCompleted} />
      </div>

      <div className="sessions-list">
        {dashboard.sessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
```

---

## Authentication

All WebSocket connections and REST API calls require authentication.

### JWT Authentication

**Login**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "PLAYER"
  }
}
```

### WebSocket Authentication

**Option 1: Token in Handshake (Recommended)**
```typescript
const socket = io(`${baseURL}/chat`, {
  auth: {
    token: 'your-jwt-token'
  },
  query: {
    playerId: 'player-123'
  }
});
```

**Option 2: Authorization Header**
```typescript
const socket = io(`${baseURL}/chat`, {
  extraHeaders: {
    Authorization: `Bearer your-jwt-token`
  },
  query: {
    playerId: 'player-123'
  }
});
```

### REST API Authentication

Include JWT in Authorization header:

```typescript
fetch('/api/games-masters/123/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Error Handling

### WebSocket Errors

All gateways emit error events in this format:

```typescript
socket.on('chat:error', (data) => {
  error: string;      // Human-readable error message
  code: string;       // Error class name
});

// Example errors:
{
  error: "Session with ID session-123 not found",
  code: "NotFoundException"
}

{
  error: "Player does not belong to this session",
  code: "ForbiddenException"
}

{
  error: "Message content cannot be empty",
  code: "BadRequestException"
}
```

### REST API Errors

Standard HTTP status codes with error details:

```json
{
  "statusCode": 404,
  "message": "Session with ID session-123 not found",
  "error": "Not Found"
}
```

### Common Error Codes

| Status | Description | Action |
|--------|-------------|--------|
| 400 | Bad Request - Invalid input | Show validation error to user |
| 401 | Unauthorized - Invalid/expired token | Redirect to login |
| 403 | Forbidden - No permission | Show "Access Denied" message |
| 404 | Not Found - Resource doesn't exist | Show "Not Found" message |
| 409 | Conflict - Duplicate/invalid state | Show specific conflict message |
| 500 | Internal Server Error | Show "Something went wrong" |

### Frontend Error Handling Example

```typescript
// Error Handler Hook
function useErrorHandler() {
  const showNotification = useNotification();
  const navigate = useNavigate();

  const handleError = (error: any, source: 'websocket' | 'http') => {
    if (source === 'websocket') {
      // WebSocket error format
      const { error: message, code } = error;

      if (code === 'UnauthorizedException') {
        navigate('/login');
      } else {
        showNotification(message, 'error');
      }
    } else {
      // HTTP error format
      const { statusCode, message } = error;

      if (statusCode === 401) {
        navigate('/login');
      } else {
        showNotification(message, 'error');
      }
    }
  };

  return handleError;
}

// Usage
function ChatComponent() {
  const handleError = useErrorHandler();
  const socket = useChatSocket();

  useEffect(() => {
    socket.on('chat:error', (error) => {
      handleError(error, 'websocket');
    });

    return () => socket.off('chat:error');
  }, []);

  // ... rest of component
}
```

---

## Testing WebSocket Connections

### Using Socket.IO Client (JavaScript Console)

```javascript
// In browser console
const socket = io('http://localhost:3000/chat', {
  query: { playerId: 'test-player-id' }
});

socket.on('connect', () => {
  console.log('Connected!', socket.id);
});

socket.on('chat:message-sent', (data) => {
  console.log('New message:', data);
});

socket.emit('send-message', {
  content: 'Test message',
  sessionId: 'your-session-id',
  playerId: 'test-player-id'
});
```

### Using Postman (REST API)

1. Create new request
2. Set method and URL
3. Add Authorization header: `Bearer your-jwt-token`
4. Send request

### Using Postman (WebSocket)

1. Create new WebSocket request
2. Set URL: `ws://localhost:3000/chat?playerId=test-player-id`
3. Connect
4. Send messages in JSON format:
```json
{
  "event": "send-message",
  "data": {
    "content": "Test message",
    "sessionId": "session-id",
    "playerId": "player-id"
  }
}
```

---

## Environment Variables

Ensure your frontend has these environment variables configured:

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3000
```

Or for production:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com
```

---

## Next Steps

1. **Update Frontend Dependencies**
   ```bash
   npm install socket.io-client
   ```

2. **Create Socket Contexts**
   - SessionSocketContext
   - GameSocketContext
   - ChatSocketContext

3. **Implement Components**
   - Chat UI with message list and input
   - Player list with online indicators
   - Timer display with countdown
   - Games Master dashboard

4. **Add Real-time Updates**
   - Subscribe to relevant WebSocket events
   - Update UI in real-time
   - Handle reconnection logic

5. **Test Integration**
   - Test chat messaging
   - Test player online/offline tracking
   - Test timer countdown and auto-advance
   - Test Games Master controls

---

## Support

For questions or issues with the API:
- Check server logs at `logs/` directory
- Review error messages in browser console
- Test endpoints with Postman/curl
- Verify JWT token is valid and not expired

## Version

**Phase 1 API - Version 1.0**
Last Updated: January 24, 2025
