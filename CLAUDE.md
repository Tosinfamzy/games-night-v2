# Claude Code Instructions - Games Night V2 Backend

## Project Overview
NestJS backend for a real-time multiplayer games night application. Features sessions, games, teams, scoring, and chat via WebSockets.

## Critical Rules

### 1. Service Size Limits (guideline, not hard gate)
- **Aim for ~300 lines per service.** When a service grows past it, that's a prompt to ask whether it should split into focused services — not an automatic mandate.
- Split only when it reduces real coupling. The SessionService/TeamService/GameService decomposition is done (see REFACTORING_PLAN.md); over-splitting was deliberately avoided.
- **Known accepted exceptions** (don't "fix" without a reason): `game.service.ts` (~600), `session.service.ts` (~575). Controllers naturally run larger and are exempt from this target.

### 2. No `any` Types
- Always use explicit types
- Create interfaces for complex objects
- Use `unknown` with type guards if type is truly unknown
- For caught errors, use `catch (error)` (unknown) with the `getErrorMessage`/`getErrorName` helpers in `src/common/utils/error.util.ts`
- The codebase currently has zero `any` types — keep it that way

### 3. Dependency Management
- **Prefer EventEmitter2** for new service↔gateway communication (see docs/CODING_STANDARDS.md).
- `forwardRef()` is used in the existing service/gateway graph and is **accepted where it already exists** — do not rip it out wholesale. The event-based migration was evaluated and deferred as not worth the added indirection (see REFACTORING_PLAN.md §3).
- Don't introduce *new* circular dependencies that need `forwardRef()` if an event or a small redesign avoids it.

### 4. Magic Numbers
- Put shared literals in `/src/common/constants/` (already established: time, limits, colors).
- Don't hardcode time durations, limits, colors, or retry counts that are reused; a single self-documenting literal local to one place is fine.

### 5. Error Handling
- Use proper NestJS exceptions (NotFoundException, BadRequestException, etc.)
- Include meaningful messages: `Game with ID ${id} not found`
- Use NestJS Logger, never console.log

### 6. Database Schema Changes
- Schema is managed by **TypeORM migrations** (`src/migrations/`), not `synchronize`.
- After changing any `*.entity.ts`, generate a migration: `npm run migration:generate -- src/migrations/<Name>`, review the SQL, then `npm run migration:run`.
- `synchronize` is dev/test convenience only and must stay **off in production**.

## File Structure
```
src/
├── common/constants/     # Shared magic numbers (time, limits, colors)
├── common/dto/           # Shared response DTOs
├── common/gateways/      # base.gateway.ts
├── migrations/           # TypeORM migrations (schema source of truth)
├── data-source.ts        # TypeORM CLI DataSource (migrations)
├── [feature]/            # Feature modules
│   ├── dto/             # Always validate DTOs
│   ├── services/        # Split-out focused services where they exist
│   └── *.service.ts     # Aim for ~300 lines
```

## Before Committing
- [ ] No new `any` types introduced
- [ ] Services kept focused (~300 lines; see accepted exceptions above)
- [ ] No new circular dependencies introduced
- [ ] Entity changes have a matching migration
- [ ] Tests pass (`npm test`)
- [ ] No console.log (use Logger)

## Reference
- Full standards: docs/CODING_STANDARDS.md
- Refactoring plan: docs/REFACTORING_PLAN.md
