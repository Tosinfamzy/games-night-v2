# Frontend Integration Checklist

Quick guide to integrate Phase 1 features into `games-nightv2-ui`.

## Prerequisites

- [ ] Backend running at `http://localhost:3000`
- [ ] Socket.IO client installed: `npm install socket.io-client`
- [ ] JWT authentication already implemented (✓ already have this)

---

## 1. Chat System Integration

### Files to Create/Update

- [ ] `src/hooks/useChatSocket.ts` - Custom hook for chat connection
- [ ] `src/components/Chat/ChatWindow.tsx` - Main chat UI
- [ ] `src/components/Chat/MessageList.tsx` - Message display
- [ ] `src/components/Chat/MessageInput.tsx` - Send message input
- [ ] `src/types/chat.types.ts` - TypeScript interfaces

### Implementation Steps

1. **Connect to Chat Namespace**
   ```typescript
   const chatSocket = io(`${API_URL}/chat`, {
     query: { playerId: currentPlayer.id }
   });
   ```

2. **Listen for Messages**
   ```typescript
   chatSocket.on('chat:message-sent', ({ message }) => {
     // Add message to state
   });
   ```

3. **Send Messages**
   ```typescript
   chatSocket.emit('send-message', {
     content: messageText,
     sessionId,
     playerId
   });
   ```

4. **Load History**
   ```typescript
   chatSocket.emit('load-history', {
     sessionId,
     limit: 50
   });
   ```

### Testing Checklist

- [ ] Can see chat window in session view
- [ ] Can send messages
- [ ] Messages appear in real-time
- [ ] Can load message history
- [ ] Can scroll and load older messages
- [ ] Messages show sender name
- [ ] Messages show timestamp
- [ ] Empty messages are prevented
- [ ] Long messages (>1000 chars) are prevented

---

## 2. Player Online Tracking

### Files to Create/Update

- [ ] `src/components/PlayerList/PlayerList.tsx` - Update to show online status
- [ ] `src/components/PlayerList/PlayerStatusIndicator.tsx` - Online/offline dot
- [ ] Update existing player list component

### Implementation Steps

1. **Listen for Online Events**
   ```typescript
   sessionSocket.on('session:player-online', ({ playerId, playerName }) => {
     // Update player.isOnline = true
     // Show notification: "{playerName} is online"
   });
   ```

2. **Listen for Offline Events**
   ```typescript
   sessionSocket.on('session:player-offline', ({ playerId, playerName }) => {
     // Update player.isOnline = false
     // Show notification: "{playerName} went offline"
   });
   ```

3. **Display Online Status**
   ```tsx
   <div className="player-item">
     <div className={`status-dot ${player.isOnline ? 'online' : 'offline'}`} />
     <span>{player.name}</span>
     {player.isOnline && <span className="badge">Online</span>}
   </div>
   ```

### Testing Checklist

- [ ] Green dot shows for online players
- [ ] Gray/red dot shows for offline players
- [ ] Status updates in real-time
- [ ] Notification shows when player connects
- [ ] Notification shows when player disconnects
- [ ] Player count shows "X/Y online"

---

## 3. Timer System

### Files to Create/Update

- [ ] `src/components/Game/TimerDisplay.tsx` - Timer countdown component
- [ ] `src/hooks/useGameTimer.ts` - Timer logic hook
- [ ] Update game view to show timer

### Implementation Steps

1. **Listen for Timer Events**
   ```typescript
   gameSocket.on('game:timer-tick', ({ timeRemaining }) => {
     // Update timer display
   });

   gameSocket.on('game:turn-started', ({ turnTimeLimit, turnEndsAt }) => {
     // Start countdown
   });

   gameSocket.on('game:timer-expired', ({ teamName }) => {
     // Show "Time's up!" notification
   });

   gameSocket.on('game:turn-advanced', ({ autoAdvanced }) => {
     if (autoAdvanced) {
       // Show "Auto-advanced due to timeout"
     }
   });
   ```

2. **Display Timer**
   ```tsx
   <div className={`timer ${timeRemaining <= 10 ? 'warning' : ''}`}>
     {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
   </div>
   ```

3. **Configure Timer When Starting Game**
   ```typescript
   await fetch(`/api/games/${gameId}/start`, {
     method: 'POST',
     body: JSON.stringify({
       turnTimeLimit: 60 // seconds
     })
   });
   ```

### Testing Checklist

- [ ] Timer displays correctly (MM:SS format)
- [ ] Timer counts down every second
- [ ] Timer turns red/warning when < 10 seconds
- [ ] "Time's up!" notification appears at 0
- [ ] Turn auto-advances when timer expires
- [ ] Timer resets for next turn
- [ ] Can start game without timer (null/0 for no limit)

---

## 4. Games Master Dashboard

### Files to Create/Update

- [ ] `src/pages/GMDashboard.tsx` - Main dashboard page
- [ ] `src/components/Dashboard/StatsCard.tsx` - Stat display cards
- [ ] `src/components/Dashboard/SessionCard.tsx` - Session overview card
- [ ] `src/components/Dashboard/GameCard.tsx` - Game status card

### Implementation Steps

1. **Fetch Dashboard Data**
   ```typescript
   const dashboard = await fetch(`/api/games-masters/${gmId}/dashboard`)
     .then(res => res.json());
   ```

2. **Display Stats**
   ```tsx
   <div className="stats-grid">
     <StatCard label="Active Sessions" value={stats.activeSessions} />
     <StatCard label="Online Players" value={stats.onlinePlayers} />
     <StatCard label="Games in Progress" value={stats.gamesInProgress} />
     <StatCard label="Games Completed" value={stats.gamesCompleted} />
   </div>
   ```

3. **Auto-Refresh on Changes**
   ```typescript
   sessionSocket.on('session:status-changed', refreshDashboard);
   sessionSocket.on('session:player-online', refreshDashboard);
   sessionSocket.on('session:player-offline', refreshDashboard);
   ```

4. **Display Session Cards**
   - Show session name, status, location
   - List players with online status
   - Show active games
   - Show game progress (round X of Y)

### Testing Checklist

- [ ] Dashboard loads on `/gm/dashboard` route
- [ ] Stats display correctly
- [ ] Sessions list shows all GM's sessions
- [ ] Online player count is accurate
- [ ] Games in progress show current turn
- [ ] Dashboard updates in real-time
- [ ] Can click session to view details
- [ ] Can control games from dashboard

---

## 5. Socket Connection Management

### Create Socket Context Providers

**File:** `src/contexts/SocketContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const SessionSocketContext = createContext<Socket | null>(null);
const ChatSocketContext = createContext<Socket | null>(null);
const GameSocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children, playerId, gameId }) {
  const [sessionSocket, setSessionSocket] = useState<Socket | null>(null);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [gameSocket, setGameSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const baseURL = process.env.REACT_APP_API_URL;

    // Connect to sessions namespace
    const session = io(`${baseURL}/sessions`, {
      query: { playerId }
    });

    // Connect to chat namespace
    const chat = io(`${baseURL}/chat`, {
      query: { playerId }
    });

    // Connect to games namespace
    const game = io(`${baseURL}/games`);

    // Handle connection events
    session.on('connect', () => console.log('Session socket connected'));
    chat.on('connect', () => console.log('Chat socket connected'));
    game.on('connect', () => console.log('Game socket connected'));

    // Handle disconnection
    session.on('disconnect', () => console.log('Session socket disconnected'));
    chat.on('disconnect', () => console.log('Chat socket disconnected'));
    game.on('disconnect', () => console.log('Game socket disconnected'));

    setSessionSocket(session);
    setChatSocket(chat);
    setGameSocket(game);

    // Cleanup on unmount
    return () => {
      session.disconnect();
      chat.disconnect();
      game.disconnect();
    };
  }, [playerId, gameId]);

  return (
    <SessionSocketContext.Provider value={sessionSocket}>
      <ChatSocketContext.Provider value={chatSocket}>
        <GameSocketContext.Provider value={gameSocket}>
          {children}
        </GameSocketContext.Provider>
      </ChatSocketContext.Provider>
    </SessionSocketContext.Provider>
  );
}

// Custom hooks
export const useSessionSocket = () => useContext(SessionSocketContext);
export const useChatSocket = () => useContext(ChatSocketContext);
export const useGameSocket = () => useContext(GameSocketContext);
```

### Testing Checklist

- [ ] Sockets connect on app load
- [ ] Sockets reconnect on disconnect
- [ ] Multiple sockets can be active simultaneously
- [ ] Sockets disconnect on logout
- [ ] Console shows connection status

---

## 6. Error Handling

### Create Error Handler

**File:** `src/utils/errorHandler.ts`

```typescript
export function handleWebSocketError(error: { error: string; code: string }) {
  switch (error.code) {
    case 'NotFoundException':
      showNotification(error.error, 'error');
      break;

    case 'ForbiddenException':
      showNotification('Access denied: ' + error.error, 'error');
      break;

    case 'UnauthorizedException':
      // Redirect to login
      window.location.href = '/login';
      break;

    case 'BadRequestException':
      showNotification(error.error, 'warning');
      break;

    default:
      showNotification('An error occurred: ' + error.error, 'error');
  }
}

export function handleHTTPError(response: Response) {
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  } else if (response.status === 403) {
    showNotification('Access denied', 'error');
  } else {
    response.json().then(data => {
      showNotification(data.message, 'error');
    });
  }
}
```

### Implementation Steps

- [ ] Add error handlers to all socket listeners
- [ ] Add error handlers to all fetch calls
- [ ] Show user-friendly error messages
- [ ] Log errors to console for debugging
- [ ] Handle authentication errors (redirect to login)

---

## 7. TypeScript Interfaces

### Create Type Definitions

**File:** `src/types/phase1.types.ts`

```typescript
// Chat types
export interface Message {
  id: string;
  content: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  type: 'text' | 'system';
  isEdited: boolean;
  createdAt: Date;
}

export interface ChatMessageEvent {
  message: Message;
  timestamp: string;
}

export interface ChatHistoryEvent {
  messages: Message[];
  hasMore: boolean;
  timestamp: string;
}

// Player online tracking types
export interface PlayerOnlineEvent {
  sessionId: string;
  playerId: string;
  playerName: string;
  timestamp: string;
}

export interface Player {
  id: string;
  name: string;
  isOnline: boolean;
  status: 'JOINED' | 'READY' | 'PLAYING' | 'DISCONNECTED';
  lastConnectedAt?: Date;
}

// Timer types
export interface TimerTickEvent {
  gameId: string;
  timeRemaining: number;
  timestamp: string;
}

export interface TurnStartedEvent {
  gameId: string;
  teamId: string;
  teamName: string;
  turnTimeLimit: number | null;
  turnStartedAt: string;
  turnEndsAt: string | null;
  timestamp: string;
}

export interface TurnAdvancedEvent {
  gameId: string;
  previousTeamId: string;
  nextTeamId: string;
  nextTeamName: string;
  turnTimeLimit: number | null;
  turnStartedAt: string;
  turnEndsAt: string | null;
  autoAdvanced: boolean;
  timestamp: string;
}

// Dashboard types
export interface GMDashboard {
  gamesMasterId: string;
  gamesMasterName: string;
  stats: DashboardStats;
  sessions: DashboardSession[];
  lastUpdated: Date;
}

export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalPlayers: number;
  onlinePlayers: number;
  totalGames: number;
  gamesInProgress: number;
  gamesCompleted: number;
}

export interface DashboardSession {
  id: string;
  name: string;
  status: string;
  location: string;
  scheduledFor: Date;
  playersCount: number;
  players: DashboardPlayer[];
  games: DashboardGame[];
  gamesInProgress: number;
  gamesCompleted: number;
}

export interface DashboardPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
  teamId?: string;
  teamName?: string;
}

export interface DashboardGame {
  id: string;
  name: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  teamsCount: number;
  currentTurnTeamId?: string;
  currentTurnTeamName?: string;
  turnStartedAt?: Date;
  turnTimeLimit?: number;
  winnerId?: string;
  createdAt: Date;
}
```

---

## 8. Environment Setup

### Update `.env` Files

**Development (`.env.development`):**
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3000
```

**Production (`.env.production`):**
```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com
```

---

## 9. Testing Plan

### Manual Testing Checklist

**Chat System:**
- [ ] Open session in two browser windows
- [ ] Send message from window 1
- [ ] Verify message appears in window 2 in real-time
- [ ] Verify message appears in window 1 (echo)
- [ ] Load more messages (pagination)
- [ ] Try sending empty message (should fail)
- [ ] Try sending 1000+ character message (should fail)

**Online Tracking:**
- [ ] Open session in two browser windows
- [ ] Verify both players show as online
- [ ] Close one window
- [ ] Verify player shows as offline in other window
- [ ] Reopen window
- [ ] Verify player shows as online again

**Timer System:**
- [ ] Start game with 60-second timer
- [ ] Verify timer counts down
- [ ] Verify timer turns red at 10 seconds
- [ ] Wait for timer to expire
- [ ] Verify turn auto-advances
- [ ] Verify new timer starts for next turn

**GM Dashboard:**
- [ ] Open dashboard as Games Master
- [ ] Verify stats are accurate
- [ ] Have player join session
- [ ] Verify online player count increases
- [ ] Start a game
- [ ] Verify games in progress increases
- [ ] Complete a game
- [ ] Verify games completed increases

---

## 10. Performance Considerations

### Optimization Checklist

- [ ] Debounce socket event handlers
- [ ] Limit message history initial load (50 messages)
- [ ] Implement virtual scrolling for long message lists
- [ ] Memoize expensive components
- [ ] Use React.memo for player list items
- [ ] Throttle timer updates (1 second intervals)
- [ ] Cache dashboard data with SWR or React Query
- [ ] Disconnect sockets when not in use
- [ ] Handle reconnection logic gracefully

---

## Common Issues & Solutions

### Issue 1: Socket Not Connecting
**Solution:** Check that backend is running and CORS is configured correctly

### Issue 2: Messages Not Appearing
**Solution:** Verify playerId is being sent in handshake query

### Issue 3: Timer Not Updating
**Solution:** Check that gameId matches and socket is listening to correct events

### Issue 4: Dashboard Not Refreshing
**Solution:** Ensure socket event listeners are properly set up and not duplicated

### Issue 5: Authentication Errors
**Solution:** Verify JWT token is valid and being sent in socket handshake

---

## Timeline Estimate

| Task | Estimated Time |
|------|----------------|
| Socket context setup | 2 hours |
| Chat UI implementation | 4-6 hours |
| Online tracking integration | 2 hours |
| Timer display | 2-3 hours |
| GM Dashboard | 6-8 hours |
| Testing & bug fixes | 4-6 hours |
| **Total** | **20-27 hours** |

---

## Support Resources

- **API Documentation:** `docs/PHASE1_API_DOCUMENTATION.md`
- **Backend Tests:** See `src/chat/chat.service.spec.ts` for examples
- **Socket.IO Docs:** https://socket.io/docs/v4/client-api/
- **Backend Logs:** Check `logs/` directory for debugging

---

## Completion Checklist

Mark as complete when:

- [ ] All socket connections working
- [ ] Chat system fully functional
- [ ] Online indicators showing correctly
- [ ] Timer countdown working
- [ ] GM Dashboard displaying all data
- [ ] All tests passing
- [ ] Error handling in place
- [ ] User notifications working
- [ ] Performance is acceptable
- [ ] Code reviewed and deployed

---

**Good luck with the integration! 🚀**

For questions or issues, refer to the full API documentation or check backend logs.
