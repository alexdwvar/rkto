# Anime API — Project Instructions

## Project Overview

REST API for an anime catalog built with Hono + Drizzle + SQLite on Bun. The full design spec lives at `docs/superpowers/specs/2026-05-22-anime-api-design.md` — read it before making changes.

## Stack

- **Runtime**: Bun (native, not Node). Run scripts with `bun`, test with `bun test`.
- **Framework**: Hono
- **ORM**: Drizzle with SQLite (bun:sqlite driver — better-sqlite3 doesn't work in Bun)
- **Validation**: Zod via `@hono/zod-validator`
- **Testing**: `bun test` with SQLite `:memory:` databases. Tests instantiate Hono app via `app.request()`, no HTTP server.

## Project Structure

Add `src/routes/docs.ts` to the project structure and update:

```
src/
  db/
    schema.ts          # Drizzle schema definitions
    connection.ts       # DB connection + pushSchema (bun:sqlite)
    seed.ts             # Seed data for development (clears tables before inserting)
  routes/
    anime.ts            # Anime endpoints (/anime, /anime/:id)
    seasons.ts          # Season endpoints (/anime/:animeId/seasons, /seasons)
    episodes.ts         # Episode endpoints (/anime/:animeId/episodes, /anime/:animeId/seasons/:seasonId/episodes)
    genres.ts           # Genre CRUD (/genres)
    relations.ts        # Anime relation endpoints (/anime/:id/relations)
    health.ts           # Health check (/health)
    docs.ts             # API docs (markdown) (/docs)
  services/
    anime.ts            # Anime business logic (batch queries for list, mapAnimeRow)
    seasons.ts          # Season business logic (validates animeId before create)
    episodes.ts         # Episode business logic (validates animeId + seasonId ownership)
    genres.ts           # Genre business logic (name resolution, auto-create, mapGenreRow)
    relations.ts        # Relation business logic (validates source+target anime exist)
  middleware/
    error-handler.ts    # Global error handling (Zod 400, UNIQUE 409, FK 400, not found 404)
    pagination.ts       # Pagination query parsing (unused in current routes, kept for future)
  validators/
    anime.ts            # Zod schemas for request validation
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
  index.ts              # App entry point (CORS, middleware, route registration)
test/
  helpers.ts            # Test DB setup, app instance, seed helpers
  anime.test.ts
  seasons.test.ts
  episodes.test.ts
  genres.test.ts
  relations.test.ts
```

## Conventions

- All API routes are prefixed with `/api`
- Response format: `{ data: ... }` for individual, `{ data: [...], pagination: {...} }` for lists
- Error format: `{ error: { code: 404, message: "Anime not found" } }`
- Validation errors return 400 with Zod error details
- Foreign key violations return 400 with clear messages
- Like search patterns escape `%` and `_` to prevent LIKE injection
- Services validate FK existence before insert (anime for seasons, anime+season for episodes, anime for relations)
- `listAnime` uses batch queries instead of N+1 per-anime queries
- Genre delete returns 404 if not found (consistent with anime/season delete)
- Services return snake_case in API responses — `mapXxxRow` helpers convert Drizzle camelCase columns to snake_case
- Relations service `createRelation` returns `mapRelationRow` with snake_case keys
- Genre list endpoint returns `anime_count` (mapped from Drizzle's `animeCount`)
- Anime `getAnimeById` returns `genres` as string array (names only), not objects
- DB tables created via `pushSchema()` function with raw DDL in connection.ts
- Every write endpoint must have a Zod validator
- Services contain business logic, routes are thin handlers that call services
- Hono routes must use full path prefixes (e.g., `/anime/:id` not `/:id`) — `app.route()` does not namespace by sub-app
- All timestamps are ISO strings stored as text in SQLite
- `alt_titles` is stored as JSON text column, parsed/stringified at the service layer
- Genres are passed as names (strings) in anime create/update, not as IDs. The service resolves names → IDs and auto-creates genres that don't exist.
- Anime status values: airing, finished, not_yet_aired, paused, cancelled

## Database Notes

- SQLite with Drizzle ORM
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`)
- `episodes` table has two unique constraints:
  - `UNIQUE(season_id, episode_number)` for TV series
  - `UNIQUE(anime_id, episode_number) WHERE season_id IS NULL` for OVAs/specials (partial index)
- Cascading deletes with `onDelete: 'cascade'` on all FK relations:
  - anime → seasons → episodes
  - anime → anime_genres
  - anime → anime_relations
- `alt_titles` stored as JSON text, not a separate table
- `anime.rating` is the global series rating; `seasons.external_rating` is per-season rating

## Key Commands

- `bun run dev` — Start dev server with hot reload
- `bun test` — Run tests
- `bun test --watch` — Run tests in watch mode
- `bun run db:generate` — Generate Drizzle migrations
- `bun run db:migrate` — Run migrations
- `bun run db:seed` — Seed the database with sample data

## API Documentation

The API exposes `GET /api/docs` which returns a markdown document describing all endpoints, parameters, and response types. This is designed to be consumed by AI agents — lightweight and always in sync with the codebase.

## V2 Considerations (NOT in scope for v1)

- Auth with JWT
- User ratings (average score per anime)
- Rate limiting by IP
- Full-text search (FTS5)
- Image upload

## Language

The user communicates in Spanish. Respond in Spanish.

## Important

After making changes — new features, schema changes, new conventions, bug fixes — update this AGENTS.md file to reflect the current state of the project. Keep conventions, database notes, and project structure in sync with what actually exists in the codebase.