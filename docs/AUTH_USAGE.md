# Authentication Usage Guide

This guide shows you how to use authentication in your controllers and services.

## Quick Start

### 1. Protecting Endpoints

#### Require Authentication (Games Masters Only)

```typescript
import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../user/user.entity';

@Controller('sessions')
export class SessionController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GAMES_MASTER)
  async createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateSessionDTO,
  ) {
    // user.gamesMasterProfile will be available
    return this.sessionService.create(dto, user.gamesMasterProfile.id);
  }
}
```

#### Optional Authentication (Allow Guests)

```typescript
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('sessions')
export class SessionController {
  @Post(':id/join')
  @UseGuards(OptionalJwtAuthGuard)
  async joinSession(
    @Param('id') id: string,
    @Body() dto: JoinSessionDTO,
    @CurrentUser() user?: User, // Optional
  ) {
    if (user) {
      // Authenticated user - link player to their account
      dto.userId = user.id;
      dto.playerName = user.name;
    } else {
      // Guest player - use provided name
      dto.isGuest = true;
    }

    return this.sessionService.joinSession(id, dto);
  }
}
```

### 2. Check Session Ownership

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard)
async deleteSession(
  @Param('id') id: string,
  @CurrentUser() user: User
) {
  const session = await this.sessionService.findOne(id);

  // Verify ownership
  if (session.host.userId !== user.id) {
    throw new ForbiddenException('You can only delete your own sessions');
  }

  return this.sessionService.delete(id);
}
```

### 3. Role-Based Access

```typescript
// Only games masters can access
@Get('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GAMES_MASTER)
async getAdminDashboard(@CurrentUser() user: User) {
  return this.dashboardService.getGamesMasterStats(user.gamesMasterProfile.id);
}

// Multiple roles allowed
@Get('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GAMES_MASTER, UserRole.PLAYER)
async getProfile(@CurrentUser() user: User) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}
```

## Frontend Integration

### API Client Setup

```typescript
// src/lib/api/client.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch {
          // Refresh failed, logout user
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
```

### Login Flow

```typescript
// Signup
const signup = async (
  email: string,
  password: string,
  name: string,
  role: 'games_master' | 'player',
) => {
  const { data } = await api.post('/auth/signup', {
    email,
    password,
    name,
    role,
  });

  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);

  return data.user;
};

// Login
const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });

  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);

  return data.user;
};

// Logout
const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

// Get current user
const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};
```

### Join Session (Guest vs Authenticated)

```typescript
// Guest join
const joinAsGuest = async (sessionId: string, playerName: string) => {
  // Don't send auth token
  const { data } = await axios.post(`/sessions/${sessionId}/join`, {
    playerName,
    joinCode: 'PLAY42',
  });
  return data;
};

// Authenticated join
const joinAsUser = async (sessionId: string) => {
  // Token automatically added by interceptor
  const { data } = await api.post(`/sessions/${sessionId}/join`, {
    joinCode: 'PLAY42',
  });
  return data;
};
```

## Testing with curl

```bash
# Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePassword123!",
    "name": "Alice",
    "role": "games_master"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePassword123!"
  }'

# Use token
curl -X POST http://localhost:3000/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Friday Game Night",
    "maxPlayers": 8
  }'

# Refresh token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'

# Get current user
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Patterns

### Check if Request is from Session Owner or Player

```typescript
async verifySessionAccess(sessionId: string, user?: User) {
  const session = await this.sessionRepo.findOne({
    where: { id: sessionId },
    relations: ['host', 'players'],
  });

  if (!session) {
    throw new NotFoundException('Session not found');
  }

  const isOwner = user && session.host.userId === user.id;
  const isPlayer = user && session.players.some(p => p.userId === user.id);
  const hasJoinCode = session.joinCode; // Assuming public session

  if (!isOwner && !isPlayer && !hasJoinCode) {
    throw new ForbiddenException('Access denied');
  }

  return session;
}
```

### Link Player to User After Anonymous Join

```typescript
async linkPlayerToUser(playerId: string, userId: string) {
  const player = await this.playerRepo.findOne({ where: { id: playerId } });

  if (player.userId) {
    throw new ConflictException('Player already linked to a user');
  }

  player.userId = userId;
  player.isGuest = false;

  return this.playerRepo.save(player);
}
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Store JWT_SECRET in environment variables** (never commit it)
3. **Use strong passwords** (minimum 8 characters, complexity rules)
4. **Implement rate limiting** (already included via ThrottlerModule)
5. **Validate input** (use class-validator DTOs)
6. **Set appropriate token expiration times** (short for access, long for refresh)
7. **Implement token rotation** for refresh tokens
8. **Add email verification** before allowing sensitive operations
9. **Implement password reset flow** with time-limited tokens
10. **Log authentication events** for audit trails

## Next Steps

1. Add email verification endpoint
2. Implement password reset flow
3. Add OAuth providers (Google, GitHub, Discord)
4. Implement refresh token rotation
5. Add two-factor authentication
6. Create admin panel for user management
