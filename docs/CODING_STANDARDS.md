# Games Night V2 - Coding Standards & Guidelines

> This document guides all development on this project - human and AI agents alike.
> Follow these standards to maintain code quality and consistency.

---

## Table of Contents

1. [General Principles](#1-general-principles)
2. [TypeScript Standards](#2-typescript-standards)
3. [NestJS Backend Standards](#3-nestjs-backend-standards)
4. [React Frontend Standards](#4-react-frontend-standards)
5. [File & Folder Structure](#5-file--folder-structure)
6. [Testing Standards](#6-testing-standards)
7. [Git & Code Review](#7-git--code-review)
8. [Anti-Patterns to Avoid](#8-anti-patterns-to-avoid)

---

## 1. General Principles

### 1.1 SOLID Principles

**Single Responsibility (SRP)**
- Each class/function should have ONE reason to change
- Services should be < 300 lines; split if larger
- Components should render ONE logical unit

```typescript
// BAD: Service doing too much
class GameService {
  createGame() { }
  startGame() { }
  calculateScores() { }  // Should be ScoreService
  broadcastUpdate() { }  // Should be handled via events
  getLeaderboard() { }   // Should be LeaderboardService
}

// GOOD: Focused services
class GameService { createGame(), findGame(), updateGame(), deleteGame() }
class GameFlowService { startGame(), pauseGame(), completeGame() }
class ScoreService { calculateScores(), getLeaderboard() }
```

**Open/Closed (OCP)**
- Code should be open for extension, closed for modification
- Use Strategy pattern for algorithms with multiple implementations

```typescript
// BAD: Adding new strategy requires modifying switch
switch (strategy) {
  case 'random': return randomAssign();
  case 'balanced': return balancedAssign();
  // Adding 'skill-based' means modifying this file
}

// GOOD: Strategy pattern
interface TeamAssignmentStrategy {
  assign(players: Player[], teamCount: number): TeamAssignment[];
}

class RandomStrategy implements TeamAssignmentStrategy { }
class BalancedStrategy implements TeamAssignmentStrategy { }
class SkillBasedStrategy implements TeamAssignmentStrategy { }  // New strategy, no modification

class TeamAssignmentService {
  constructor(private strategies: Map<string, TeamAssignmentStrategy>) {}

  assign(strategyName: string, players: Player[], teamCount: number) {
    return this.strategies.get(strategyName).assign(players, teamCount);
  }
}
```

**Dependency Inversion (DIP)**
- High-level modules should not depend on low-level modules
- Use dependency injection; avoid `new` inside classes
- Never use `forwardRef()` - it indicates a design problem

```typescript
// BAD: Circular dependency
@Injectable()
class GameService {
  constructor(@Inject(forwardRef(() => GameGateway)) private gateway: GameGateway) {}
}

// GOOD: Event-based decoupling
@Injectable()
class GameService {
  constructor(private eventEmitter: EventEmitter2) {}

  async completeGame(id: string) {
    const game = await this.complete(id);
    this.eventEmitter.emit('game.completed', { gameId: id, results: game.results });
  }
}

@Injectable()
class GameGateway {
  @OnEvent('game.completed')
  handleGameCompleted(event: GameCompletedEvent) {
    this.broadcast(`game:${event.gameId}`, 'game:completed', event);
  }
}
```

### 1.2 DRY (Don't Repeat Yourself)

- If you copy-paste code, extract it
- Create utility functions for repeated patterns
- Use base classes/hooks for shared behavior

```typescript
// BAD: Repeated pattern
// In GameService
const game = await this.repo.findOne({ where: { id } });
if (!game) throw new NotFoundException('Game not found');

// In SessionService
const session = await this.repo.findOne({ where: { id } });
if (!session) throw new NotFoundException('Session not found');

// GOOD: Extracted utility
async function findOrFail<T>(repo: Repository<T>, id: string, entityName: string): Promise<T> {
  const entity = await repo.findOne({ where: { id } });
  if (!entity) throw new NotFoundException(`${entityName} not found`);
  return entity;
}

// Usage
const game = await findOrFail(this.gameRepo, id, 'Game');
```

### 1.3 No Magic Numbers/Strings

All literal values should be named constants.

```typescript
// BAD
if (attempts > 10) { }
setTimeout(callback, 86400000);
const colors = ['#FF5733', '#3366FF'];

// GOOD
// /src/common/constants/limits.constants.ts
export const LIMITS = {
  JOIN_CODE_MAX_ATTEMPTS: 10,
  MAX_TEAMS: 8,
} as const;

// /src/common/constants/time.constants.ts
export const TIME = {
  ONE_DAY_MS: 86400000,
  PLAYER_TOKEN_EXPIRY_MS: 86400000,
} as const;

// /src/common/constants/colors.constants.ts
export const DEFAULT_TEAM_COLORS = ['#FF5733', '#3366FF'] as const;

// Usage
if (attempts > LIMITS.JOIN_CODE_MAX_ATTEMPTS) { }
```

---

## 2. TypeScript Standards

### 2.1 Never Use `any`

```typescript
// BAD
function processData(data: any): any { }
const result: any = await fetchData();

// GOOD
interface GameData { id: string; status: GameStatus; }
function processData(data: GameData): ProcessedResult { }
const result: GameData = await fetchData();

// If type is truly unknown, use `unknown` and narrow
function handleEvent(data: unknown) {
  if (isGameEvent(data)) {
    // data is now typed as GameEvent
  }
}
```

### 2.2 Explicit Return Types

All exported functions must have explicit return types.

```typescript
// BAD
export async function getGame(id: string) {
  return this.repo.findOne({ where: { id } });
}

// GOOD
export async function getGame(id: string): Promise<Game | null> {
  return this.repo.findOne({ where: { id } });
}
```

### 2.3 Interface vs Type

- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and primitives

```typescript
// Interface for extendable shapes
interface BaseEntity {
  id: string;
  createdAt: Date;
}

interface Game extends BaseEntity {
  status: GameStatus;
}

// Type for unions/computed types
type GameStatus = 'scheduled' | 'in_progress' | 'completed';
type GameWithTeams = Game & { teams: Team[] };
```

### 2.4 Enums

Use string enums for readability in logs/DB.

```typescript
// BAD: Numeric enum
enum Status { Active, Inactive }  // 0, 1 in DB - unclear

// GOOD: String enum
enum GameStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}
```

---

## 3. NestJS Backend Standards

### 3.1 Service Size Limits

| Service Type | Max Lines | Action if Exceeded |
|--------------|-----------|-------------------|
| CRUD Service | 200 | Extract business logic |
| Business Service | 300 | Split into focused services |
| Gateway | 150 | Move logic to services |

### 3.2 Controller Responsibilities

Controllers should ONLY:
- Validate input (via DTOs/Pipes)
- Call service methods
- Return responses

```typescript
// BAD: Logic in controller
@Post()
async createGame(@Body() dto: CreateGameDto) {
  const session = await this.sessionRepo.findOne(dto.sessionId);
  if (!session) throw new NotFoundException();
  if (session.status !== 'active') throw new BadRequestException();
  // ... more logic
}

// GOOD: Delegate to service
@Post()
async createGame(@Body() dto: CreateGameDto): Promise<Game> {
  return this.gameService.create(dto);
}
```

### 3.3 DTO Validation

All DTOs must have:
- Class-validator decorators
- ApiProperty decorators for Swagger
- Proper types (no `any`)

```typescript
export class CreateGameDto {
  @ApiProperty({ description: 'Session ID', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Game library template ID' })
  @IsUUID()
  @IsNotEmpty()
  gameLibraryId: string;

  @ApiProperty({ description: 'Number of rounds', minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  rounds?: number = 3;
}
```

### 3.4 Error Handling

Use proper NestJS exceptions with meaningful messages.

```typescript
// BAD
throw new Error('Not found');
throw new BadRequestException('Error');

// GOOD
throw new NotFoundException(`Game with ID ${id} not found`);
throw new BadRequestException(`Cannot start game: ${game.status} status is not 'scheduled'`);
throw new ConflictException(`Player ${player.name} is already in a team`);
```

### 3.5 Database Patterns

**Always use transactions for multi-entity operations:**

```typescript
// BAD: No transaction
async joinSession(dto: JoinDto) {
  const player = await this.playerRepo.save({ ... });
  await this.sessionRepo.update(sessionId, { ... });  // If this fails, player is orphaned
}

// GOOD: Transaction
async joinSession(dto: JoinDto) {
  return this.dataSource.transaction(async (manager) => {
    const player = await manager.save(Player, { ... });
    await manager.update(Session, sessionId, { ... });
    return player;
  });
}
```

**Avoid N+1 queries:**

```typescript
// BAD: N+1 query
const teams = await this.teamRepo.find({ where: { gameId } });
for (const team of teams) {
  team.players = await this.playerRepo.find({ where: { teamId: team.id } });
}

// GOOD: Eager load or join
const teams = await this.teamRepo.find({
  where: { game: { id: gameId } },
  relations: ['players'],
});
```

---

## 4. React Frontend Standards

### 4.1 Component Size Limits

| Component Type | Max Lines | Action if Exceeded |
|----------------|-----------|-------------------|
| Page/Route | 200 | Extract to sub-components |
| Feature Component | 150 | Split into smaller components |
| UI Component | 100 | Keep atomic |

### 4.2 Component Structure

```typescript
// Recommended order within component file
import { } from 'react';                    // 1. React imports
import { } from '@tanstack/react-query';    // 2. External libraries
import { } from '@/components';              // 3. Internal components
import { } from '@/hooks';                   // 4. Hooks
import { } from '@/lib';                     // 5. Utilities
import { } from './types';                   // 6. Local types

interface Props { }                          // 7. Props interface

export function Component({ prop }: Props) { // 8. Component
  // State declarations
  // Queries/Mutations
  // Effects
  // Handlers
  // Render
}
```

### 4.3 Custom Hooks

Extract logic into hooks when:
- Logic is reused across components
- Component is getting too large
- Logic is testable independently

```typescript
// BAD: Logic in component
function GamePage() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGame(id).then(setGame).finally(() => setLoading(false));
  }, [id]);

  // ... 50 more lines of state/effects
}

// GOOD: Extracted hook
function useGame(id: string) {
  return useQuery({
    queryKey: ['games', id],
    queryFn: () => gameService.findOne(id),
  });
}

function GamePage() {
  const { data: game, isLoading } = useGame(id);
  // Clean component focused on rendering
}
```

### 4.4 State Management

| State Type | Solution |
|------------|----------|
| Server state | TanStack Query |
| Form state | React Hook Form |
| Global UI state | Context or Zustand |
| Local UI state | useState |

```typescript
// Server state - TanStack Query
const { data, isLoading } = useQuery({ queryKey: ['games'], queryFn: fetchGames });

// Form state - React Hook Form
const { register, handleSubmit } = useForm<CreateGameForm>();

// Global UI state - Context
const { theme, setTheme } = useTheme();

// Local UI state - useState
const [isModalOpen, setIsModalOpen] = useState(false);
```

### 4.5 Error Boundaries

Wrap feature sections with error boundaries.

```typescript
// /src/components/ErrorBoundary.tsx
export function FeatureErrorBoundary({ children, fallback }: Props) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorDisplay error={error} onRetry={resetErrorBoundary} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// Usage
<FeatureErrorBoundary>
  <GameDashboard />
</FeatureErrorBoundary>
```

---

## 5. File & Folder Structure

### 5.1 Backend Structure

```
src/
├── common/                    # Shared utilities
│   ├── constants/            # Magic numbers/strings
│   ├── decorators/           # Custom decorators
│   ├── filters/              # Exception filters
│   ├── guards/               # Auth guards
│   ├── interceptors/         # Response transformers
│   ├── interfaces/           # Shared interfaces
│   └── utils/                # Helper functions
├── config/                    # Configuration
├── [feature]/                 # Feature modules
│   ├── dto/                  # Data transfer objects
│   ├── entities/             # TypeORM entities
│   ├── interfaces/           # Feature-specific interfaces
│   ├── [feature].controller.ts
│   ├── [feature].service.ts
│   ├── [feature].module.ts
│   ├── [feature].gateway.ts   # If WebSocket needed
│   └── [feature].service.spec.ts
└── main.ts
```

### 5.2 Frontend Structure

```
src/
├── components/               # Shared components
│   ├── ui/                  # Atomic UI components
│   └── [Feature]/           # Feature-specific components
├── contexts/                 # React contexts
├── hooks/                    # Custom hooks
├── lib/
│   ├── api/                 # API client & services
│   │   ├── client.ts
│   │   └── services/
│   ├── socket/              # WebSocket hooks
│   ├── utils/               # Helper functions
│   └── constants/           # Frontend constants
├── routes/                   # TanStack Router routes
└── main.tsx
```

### 5.3 File Naming

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `GameCard.tsx` |
| Hook | camelCase with `use` | `useGame.ts` |
| Utility | kebab-case | `date-utils.ts` |
| Constant | kebab-case | `time.constants.ts` |
| Type/Interface | PascalCase | `game.types.ts` |
| Test | same + `.spec` or `.test` | `game.service.spec.ts` |

---

## 6. Testing Standards

### 6.1 Test Coverage Requirements

| Code Type | Minimum Coverage |
|-----------|-----------------|
| Services | 80% |
| Controllers | 70% |
| Utilities | 90% |
| Components | 60% |
| Hooks | 70% |

### 6.2 Test Structure

```typescript
describe('GameService', () => {
  describe('createGame', () => {
    it('should create a game with valid input', async () => {
      // Arrange
      const dto = { sessionId: 'uuid', gameLibraryId: 'uuid' };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(GameStatus.SCHEDULED);
    });

    it('should throw NotFoundException when session not found', async () => {
      // Arrange
      jest.spyOn(sessionRepo, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 6.3 Mock Typing

Never use `any` in mocks.

```typescript
// BAD
let service: any;
let mockRepo: any;

// GOOD
let service: GameService;
let mockRepo: jest.Mocked<Repository<Game>>;

beforeEach(() => {
  mockRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    // ... typed mock methods
  } as unknown as jest.Mocked<Repository<Game>>;
});
```

---

## 7. Git & Code Review

### 7.1 Commit Messages

Follow Conventional Commits:

```
feat: add team rebalancing feature
fix: resolve score calculation race condition
refactor: split SessionService into focused services
docs: update API documentation
test: add integration tests for game flow
chore: update dependencies
```

### 7.2 PR Checklist

Before submitting PR, verify:

- [ ] No `any` types introduced
- [ ] No magic numbers/strings
- [ ] No circular dependencies
- [ ] Tests added/updated
- [ ] No console.log (use Logger)
- [ ] Error handling is proper
- [ ] Types are explicit
- [ ] Service size < 300 lines
- [ ] Component size < 200 lines

---

## 8. Anti-Patterns to Avoid

### 8.1 God Classes/Components

**Symptom:** File > 300 lines with multiple responsibilities
**Solution:** Split into focused modules

### 8.2 Circular Dependencies

**Symptom:** Using `forwardRef()` or seeing circular import warnings
**Solution:** Use event-based communication or restructure modules

### 8.3 Prop Drilling

**Symptom:** Passing props through 3+ component levels
**Solution:** Use Context or component composition

### 8.4 Leaky Abstractions

**Symptom:** Internal implementation details exposed in public API
**Solution:** Define clear interfaces, hide implementation

### 8.5 Premature Optimization

**Symptom:** Complex caching/memoization without measured need
**Solution:** Profile first, optimize where needed

### 8.6 Copy-Paste Programming

**Symptom:** Similar code blocks in multiple files
**Solution:** Extract to shared utilities/hooks/base classes

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE WRITING CODE                       │
├─────────────────────────────────────────────────────────────┤
│ □ Is there existing code I can reuse/extend?                │
│ □ Will this file exceed size limits? Plan to split.         │
│ □ Am I using proper types? No 'any'.                        │
│ □ Are magic values extracted to constants?                  │
│ □ Is error handling proper?                                 │
├─────────────────────────────────────────────────────────────┤
│                    BEFORE COMMITTING                         │
├─────────────────────────────────────────────────────────────┤
│ □ Tests pass                                                │
│ □ No TypeScript errors                                      │
│ □ No console.log statements                                 │
│ □ Commit message follows convention                         │
│ □ No circular dependencies                                  │
└─────────────────────────────────────────────────────────────┘
```

---

*Last Updated: January 2026*
