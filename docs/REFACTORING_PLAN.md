# Games Night V2 - Refactoring Plan

> Generated: January 2026
> Priority: High items should be addressed before new features

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 Remove Type Safety Violations

**Backend:**
- [ ] Fix `getGameStats(): Promise<any>` in `game.service.ts:462` - create proper `GameStats` interface
- [ ] Remove `any` types from test mocks - create proper mock types
- [ ] Fix private property access `this.gameService['teamService']` in `game-timer.service.ts:134`

**Frontend:**
- [ ] Audit all `any` usage and replace with proper types
- [ ] Add explicit return types to all exported functions

### 1.2 Extract Magic Numbers to Constants

**Backend - Create `/src/common/constants/`:**
```typescript
// /src/common/constants/time.constants.ts
export const TIME = {
  PLAYER_TOKEN_EXPIRY_SECONDS: 86400,  // 24 hours
  TIMER_WARNING_THRESHOLDS: [30, 10, 5],
  JOIN_CODE_MAX_ATTEMPTS: 10,
} as const;

// /src/common/constants/limits.constants.ts
export const LIMITS = {
  MAX_TEAMS_PER_GAME: 8,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_PLAYERS_PER_SESSION: 50,
} as const;

// /src/common/constants/colors.constants.ts
export const DEFAULT_TEAM_COLORS = [
  '#FF5733', '#3366FF', '#28A745', '#FFC107',
  '#6F42C1', '#FD7E14', '#20C997', '#E83E8C',
] as const;
```

**Frontend - Create `/src/lib/constants/`:**
- Toast durations
- Pagination limits
- Socket reconnection settings

---

## Phase 2: Service Decomposition (Week 2-3)

### 2.1 Split SessionService (1,090 lines → 4 services)

```
SessionService (1,090 lines)
    ├── SessionService (~200 lines) - CRUD operations only
    ├── SessionLifecycleService (~150 lines) - start, complete, cancel
    ├── SessionPlayerService (~200 lines) - join, rejoin, player management
    └── SessionReadinessService (~150 lines) - readiness checks, validation
```

**Migration Steps:**
1. Create new service files with proper interfaces
2. Move methods one at a time with tests
3. Update imports in controllers/gateways
4. Remove old methods from SessionService

### 2.2 Split GameService (698 lines → 4 services)

```
GameService (698 lines)
    ├── GameService (~150 lines) - CRUD operations
    ├── GameFlowService (~150 lines) - start, pause, resume, complete
    ├── GameTurnService (~100 lines) - turn management, rotation
    └── GameStatsService (~100 lines) - statistics, results
```

### 2.3 Split TeamService (832 lines → 3 services)

```
TeamService (832 lines)
    ├── TeamService (~150 lines) - CRUD operations
    ├── TeamFormationService (~200 lines) - creation strategies
    └── TeamAssignmentService (~150 lines) - player assignment, rebalancing
```

---

## Phase 3: Resolve Circular Dependencies (Week 3)

### 3.1 Current Circular Deps

```
GameService ←→ GameGateway
GameService ←→ GameTimerService
SessionService ←→ SessionGateway
TeamService ←→ SessionGateway
```

### 3.2 Solution: Event-Based Communication

**Create Event Contracts:**
```typescript
// /src/common/events/game.events.ts
export const GameEvents = {
  STARTED: 'game.started',
  COMPLETED: 'game.completed',
  TURN_CHANGED: 'game.turn.changed',
  SCORE_UPDATED: 'game.score.updated',
} as const;

export interface GameStartedEvent {
  gameId: string;
  sessionId: string;
  teams: string[];
}
```

**Refactor Pattern:**
```typescript
// Before (circular)
@Injectable()
export class GameService {
  constructor(
    @Inject(forwardRef(() => GameGateway))
    private gateway: GameGateway,
  ) {}

  async startGame(id: string) {
    // ... logic
    this.gateway.broadcastGameStarted(game);
  }
}

// After (event-based)
@Injectable()
export class GameService {
  constructor(private eventEmitter: EventEmitter2) {}

  async startGame(id: string) {
    // ... logic
    this.eventEmitter.emit(GameEvents.STARTED, { gameId: id, ... });
  }
}

@Injectable()
export class GameGateway {
  @OnEvent(GameEvents.STARTED)
  handleGameStarted(event: GameStartedEvent) {
    this.broadcastToRoom(`game:${event.gameId}`, 'game:started', event);
  }
}
```

---

## Phase 4: Frontend Component Refactoring (Week 4)

### 4.1 Split Session Detail Page

**Current:** `sessions/$id.tsx` (1,264 lines)

**Target Structure:**
```
routes/sessions/$id.tsx (~200 lines) - Layout & routing only
components/session/
    ├── SessionHeader.tsx
    ├── SessionTabs.tsx
    ├── tabs/
    │   ├── OverviewTab.tsx
    │   ├── PlayersTab.tsx
    │   ├── GamesTab.tsx (already EnhancedGamesTab)
    │   ├── TeamsTab.tsx
    │   ├── ChatTab.tsx
    │   └── HistoryTab.tsx
    └── SessionModals.tsx
```

### 4.2 Extract Shared Patterns

**Create Custom Hooks:**
```typescript
// /src/hooks/useConfirmDialog.ts
export function useConfirmDialog() {
  const [state, setState] = useState({ isOpen: false, ... });
  return { open, close, confirm, ConfirmDialogProps };
}

// /src/hooks/useFormMutation.ts
export function useFormMutation<T>(options: MutationOptions<T>) {
  // Handles loading, error, success states consistently
}
```

---

## Phase 5: Database & Production Readiness (Week 5)

### 5.1 Add Database Migrations

```bash
# Remove synchronize: true
# Add migration scripts

npm run typeorm migration:generate -- -n InitialSchema
npm run typeorm migration:run
```

### 5.2 Add Transaction Management

```typescript
// Create transaction decorator or use QueryRunner
@Injectable()
export class SessionPlayerService {
  async joinSession(dto: JoinSessionDto) {
    return this.dataSource.transaction(async (manager) => {
      const player = await manager.save(Player, { ... });
      await manager.update(Session, sessionId, { ... });
      return player;
    });
  }
}
```

### 5.3 Add Global Exception Filter

```typescript
// /src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Standardized error response format
    // Proper logging
    // Error tracking integration
  }
}
```

---

## Phase 6: Testing & Documentation (Week 6)

### 6.1 Increase Test Coverage

**Current:** 14 test files / 134 source files (10.4%)
**Target:** 60%+ coverage on critical paths

**Priority Tests:**
1. SessionService (after split)
2. GameFlowService
3. TeamFormationService
4. Auth flows
5. WebSocket event handlers

### 6.2 Add Integration Tests

```typescript
// /test/integration/game-flow.e2e-spec.ts
describe('Game Flow Integration', () => {
  it('should complete full game lifecycle', async () => {
    // Create session → Add players → Form teams → Start game → Play rounds → Complete
  });
});
```

---

## Progress Tracking

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 1.1 | Fix type safety | ✅ Complete | GameStats interface created, private property access fixed |
| 1.2 | Extract constants | ⏭️ Skipped | Low value - numbers are self-documenting with comments |
| 2.1 | Split SessionService | ✅ Complete | 3 services: Readiness, Lifecycle, Player |
| 2.2 | Split GameService | ✅ Partial | GameStatsService extracted; GameTurnService/GameFlowService skipped (overengineering) |
| 2.3 | Split TeamService | ✅ Complete | 2 services: Formation, Assignment |
| 3.1 | Event-based comms | ⏭️ Skipped | forwardRef() works fine, events add complexity without benefit |
| 4.1 | Split session page | ⬜ Not Started | Worth doing if actively developing frontend |
| 4.2 | Extract hooks | ⏭️ Skipped | Extract only when pattern repeats 3+ times |
| 5.1 | DB migrations | ⬜ Not Started | **Required before production** |
| 5.2 | Transactions | ⬜ Not Started | Add incrementally where needed |
| 5.3 | Exception filter | ⬜ Not Started | Nice to have |
| 6.1 | Unit tests | ✅ Good State | 312 tests passing |
| 6.2 | Integration tests | ⬜ Not Started | High value |

---

## Definition of Done

Each refactoring task is complete when:
- [ ] Code compiles without errors
- [ ] All existing tests pass
- [ ] New code has test coverage
- [ ] No `any` types introduced
- [ ] No circular dependencies created
- [ ] Code reviewed (or self-reviewed against CODING_STANDARDS.md)
- [ ] Documentation updated if API changed
