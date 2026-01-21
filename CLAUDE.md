# Claude Code Instructions - Games Night V2 Backend

## Project Overview
NestJS backend for a real-time multiplayer games night application. Features sessions, games, teams, scoring, and chat via WebSockets.

## Critical Rules

### 1. Service Size Limits
- **Max 300 lines per service** - If approaching limit, split into focused services
- Large services to avoid: GameService, SessionService, TeamService (currently oversized - see REFACTORING_PLAN.md)

### 2. No `any` Types
- Always use explicit types
- Create interfaces for complex objects
- Use `unknown` with type guards if type is truly unknown

### 3. No Circular Dependencies
- Never use `forwardRef()` - it indicates a design problem
- Use EventEmitter2 for service-to-gateway communication
- See docs/CODING_STANDARDS.md for patterns

### 4. Magic Numbers
- All literals must be in `/src/common/constants/`
- Never hardcode: time durations, limits, colors, retry counts

### 5. Error Handling
- Use proper NestJS exceptions (NotFoundException, BadRequestException, etc.)
- Include meaningful messages: `Game with ID ${id} not found`
- Use NestJS Logger, never console.log

## File Structure
```
src/
├── common/constants/     # Put magic numbers here
├── common/interfaces/    # Shared interfaces
├── [feature]/           # Feature modules
│   ├── dto/            # Always validate DTOs
│   └── *.service.ts    # Keep under 300 lines
```

## Before Committing
- [ ] No `any` types introduced
- [ ] Services < 300 lines
- [ ] No circular dependencies
- [ ] Tests pass
- [ ] No console.log (use Logger)

## Reference
- Full standards: docs/CODING_STANDARDS.md
- Refactoring plan: docs/REFACTORING_PLAN.md
