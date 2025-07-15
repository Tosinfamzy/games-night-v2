# Games Night Frontend Proposal

## Overview

This document outlines the frontend architecture and implementation plan for the Games Night application, which will interface with our existing NestJS backend API.

## Technology Stack

### Core Technologies

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **State Management**:
  - TanStack Query v5 (React Query) for server state
  - Zustand for local state
- **Form Handling**: React Hook Form + Zod
- **Styling**: Tailwind CSS + Shadcn/UI
- **HTTP Client**: Axios with interceptors
- **Type Safety**: Zod for runtime validation
- **Testing**: Vitest + React Testing Library

### Key Libraries

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.45.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "axios": "^1.6.0",
    "@shadcn/ui": "^0.5.0",
    "tailwindcss": "^3.3.0",
    "clsx": "^2.0.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "vitest": "^0.34.0",
    "@testing-library/react": "^14.0.0",
    "@types/react": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── forms/             # Form components
│   ├── layout/            # Layout components
│   └── features/          # Feature-specific components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configs
├── api/                   # API client and type definitions
├── stores/                # Zustand stores
└── types/                 # TypeScript type definitions
```

### Feature Modules

1. **Authentication & User Management**
   - Games Master registration/login
   - Profile management
   - Session persistence

2. **Session Management**
   - Session creation wizard
   - Session overview dashboard
   - Active session management
   - Historical session view

3. **Game Management**
   - Game setup interface
   - Round management
   - Score tracking
   - Real-time game state updates

4. **Team & Player Management**
   - Team creation and assignment
   - Player registration
   - Team balance suggestions

5. **Scoring & Statistics**
   - Real-time scoreboard
   - Round-by-round scoring
   - Historical statistics
   - Performance analytics

## UI/UX Design Guidelines

### Layout Structure

1. **Primary Navigation**
   - Dashboard
   - Sessions
   - Games
   - Teams
   - Players
   - Statistics

2. **Session Flow**

   ```
   Dashboard
   └─> Create Session
       └─> Configure Games
           └─> Assign Teams
               └─> Start Session
                   └─> Manage Games
                       └─> End Session
   ```

3. **Game Flow**
   ```
   Active Session
   └─> Select Game
       └─> Assign Teams
           └─> Start Game
               └─> Manage Rounds
                   └─> Submit Scores
                       └─> End Game
   ```

### Component Design

- Use Shadcn/UI for consistent design system
- Mobile-first responsive design
- Dark mode support
- Accessible components (ARIA compliant)

## API Integration

### Type Generation

Generate TypeScript types from Swagger/OpenAPI spec:

```typescript
// Example type for Session
interface Session {
  id: string;
  date: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  host: GamesMaster;
  games: Game[];
  teams: Team[];
  players: Player[];
}
```

### API Client Structure

```typescript
// Example API client setup
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session endpoints
export const sessionApi = {
  create: (data: CreateSessionDto) => api.post<Session>('/sessions', data),
  getAll: () => api.get<Session[]>('/sessions'),
  getById: (id: string) => api.get<Session>(`/sessions/${id}`),
  start: (id: string) => api.post<Session>(`/sessions/${id}/start`),
  // ... other endpoints
};
```

## State Management

### Server State (TanStack Query)

```typescript
// Example query hooks
export const useSession = (id: string) => {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => sessionApi.getById(id),
  });
};

export const useUpdateScore = () => {
  return useMutation({
    mutationFn: (data: SubmitScoreDto) => scoreApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] });
    },
  });
};
```

### Local State (Zustand)

```typescript
// Example game state store
interface GameState {
  currentRound: number;
  scores: Record<string, number>;
  setCurrentRound: (round: number) => void;
  updateScore: (teamId: string, score: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentRound: 1,
  scores: {},
  setCurrentRound: (round) => set({ currentRound: round }),
  updateScore: (teamId, score) =>
    set((state) => ({
      scores: { ...state.scores, [teamId]: score },
    })),
}));
```

## Key Features Implementation

### 1. Session Dashboard

- Real-time session status updates
- Quick actions for session management
- Upcoming sessions calendar
- Active session overview

### 2. Game Management Interface

- Intuitive game setup wizard
- Round progression controls
- Team score input interface
- Game state visualization

### 3. Scoreboard

- Real-time score updates
- Round-by-round breakdown
- Team rankings
- Score history

### 4. Team Management

- Team creation interface
- Player assignment
- Team performance statistics
- Balance suggestions

## Performance Considerations

1. **Data Fetching**
   - Implement stale-while-revalidate strategy
   - Optimistic updates for better UX
   - Proper error boundaries and fallbacks

2. **State Management**
   - Minimize global state
   - Use React Query for caching
   - Implement proper loading states

3. **Optimization**
   - Code splitting
   - Image optimization
   - Component lazy loading
   - Memoization where necessary

## Testing Strategy

1. **Unit Tests**
   - Component testing with React Testing Library
   - Hook testing
   - Utility function testing

2. **Integration Tests**
   - Page-level tests
   - API integration tests
   - State management tests

3. **E2E Tests**
   - Critical user flows
   - Form submissions
   - Navigation testing

## Development Process

1. **Setup Phase**
   - Project initialization
   - Core dependencies installation
   - Basic layout implementation
   - API client setup

2. **Feature Implementation**
   - Authentication system
   - Session management
   - Game flow
   - Scoring system
   - Team management

3. **Polish Phase**
   - UI/UX improvements
   - Performance optimization
   - Error handling
   - Testing
   - Documentation

## Getting Started

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

## Next Steps

1. Set up project with Next.js and core dependencies
2. Implement basic layout and navigation
3. Create API client and type definitions
4. Begin feature implementation starting with authentication
5. Implement core game flow features
6. Add team and player management
7. Develop scoring system
8. Add statistics and analytics
9. Polish UI/UX
10. Comprehensive testing

Would you like to proceed with the frontend implementation?
