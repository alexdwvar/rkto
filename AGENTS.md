# Anime API — Project Instructions

## Project Overview

REST API for an anime catalog built with Hono + Drizzle + SQLite on Bun. The full design spec lives at `docs/superpowers/specs/2026-05-22-anime-api-design.md` — read it before making changes.

## Stack

- **Runtime**: Bun (native, not Node). Run scripts with `bun`, test with `bun test`.
- **Framework**: Hono
- **ORM**: Drizzle with SQLite (better-sqlite3 driver)
- **Validation**: Zod via `@hono/zod-openapi` or Hono's `zValidator`
- **Testing**: `bun test` with SQLite `:memory:` databases. Tests instantiate Hono app via `app.request()`, no HTTP server.

## Project Structure

```
src/
  db/
    schema.ts          # Drizzle schema definitions
    connection.ts       # DB connection + migration setup
    seed.ts             # Seed data for development
  routes/
    anime.ts            # Anime endpoints
    seasons.ts          # Season endpoints (nested under anime + global /api/seasons)
    episodes.ts         # Episode endpoints (nested under anime/seasons)
    genres.ts           # Genre CRUD
    relations.ts        # Anime relation endpoints
    health.ts           # Health check
  services/
    anime.ts            # Anime business logic
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
  middleware/
    error-handler.ts    # Global error handling
    pagination.ts       # Pagination query parsing
  validators/
    anime.ts            # Zod schemas for request validation
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
  index.ts              # App entry point
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
- Use Drizzle schema types, never raw SQL unless absolutely necessary
- Every write endpoint must have a Zod validator
- Services contain business logic, routes are thin handlers that call services
- DB connection is injected into the app context via Hono middleware
- All timestamps are ISO strings stored as text in SQLite
- `alt_titles` is stored as JSON text column, parsed/stringified at the service layer
- Genres are passed as names (strings) in anime create/update, not as IDs. The service resolves names → IDs and auto-creates genres that don't exist.

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
- `bun run db:studio` — Open Drizzle Studio

## V2 Considerations (NOT in scope for v1)

- Auth with JWT
- User ratings (average score per anime)
- Rate limiting by IP
- Full-text search (FTS5)
- Image upload

## Language

The user communicates in Spanish. Respond in Spanish.