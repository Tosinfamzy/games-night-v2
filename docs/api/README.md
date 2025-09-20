# Games Night API Guide for Frontend

This directory contains assets that help the frontend consume the NestJS API.

## Quick Start

- Swagger UI: `http://localhost:3000/api`
- OpenAPI JSON: `docs/api/openapi.json`

The JSON file is a snapshot of the live Swagger schema. Pull it into Postman, Insomnia, or your frontend build tooling to generate clients or typings.

## Response Shapes

Most endpoints return pruned DTOs rather than full TypeORM entities. Common fields:

- `SessionResponseDto`: summary info, counts (`gamesCount`, `teamsCount`, `playersCount`), and related IDs (`gameIds`, `teamIds`, `playerIds`).
- `GameResponseDto`: gameplay status, round metadata, and relation IDs.
- `TeamResponseDto` / `PlayerResponseDto`: only IDs of related records plus lifecycle timestamps.
- `GamesMasterResponseDto`, `GameLibraryResponseDto`, `ScoreResponseDto`: trimmed to the data the UI typically needs.

If you need additional fields, update the DTOs in `src/common/dto/` instead of returning raw entities.

## Best Practices

- Add auth headers once guards are enabled—currently endpoints are open for development.
- Prefer filtered list endpoints (e.g. `/v1/sessions?status=in-progress`) as they are added to avoid heavy payloads.
- Treat the OpenAPI JSON as generated output; regenerate whenever the backend changes DTOs or routes.

## Regenerating the Schema

1. Run the API (`npm run start:dev`).
2. Fetch the schema:
   ```bash
   curl http://localhost:3000/api-json -o docs/api/openapi.json
   ```
3. Commit the updated JSON alongside backend changes so the frontend stays in sync.

