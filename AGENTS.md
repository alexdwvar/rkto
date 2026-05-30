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
    anime.ts            # Anime endpoints (/anime, /anime/:idOrSlug)
    seasons.ts          # Season endpoints (/anime/:animeId/seasons, /seasons)
    episodes.ts         # Episode endpoints (/anime/:animeId/episodes, /anime/:animeId/seasons/:seasonId/episodes)
    genres.ts           # Genre CRUD (/genres)
    relations.ts        # Anime relation endpoints (/anime/:id/relations)
    tmdb.ts             # TMDB proxy + import (/tmdb/search, /tmdb/tv/:id, /tmdb/import/:id)
    media.ts            # Media storage endpoints (/media/upload-url, /media/confirm, /media/episode/:id, /media/anime/:id, /media/:id/play, DELETE /media/:id)
    health.ts           # Health check (/health)
    docs.ts             # API docs (markdown) (/docs)
  services/
    anime.ts            # Anime business logic (batch queries for list, mapAnimeRow)
    seasons.ts          # Season business logic (validates animeId before create)
    episodes.ts         # Episode business logic (validates animeId + seasonId ownership, normalizeVideoSources)
    genres.ts           # Genre business logic (name resolution, auto-create, mapGenreRow)
    relations.ts        # Relation business logic (validates source+target anime exist)
    tmdb.ts             # TMDB API client (search, TV detail, season detail, genre map, image URLs, status mapping)
    tmdb-import.ts      # Imports TMDB data into local DB (anime + genres + seasons + optionally episodes)
    media.ts            # R2 presigned URLs, CRUD for media references
  middleware/
    error-handler.ts    # Global error handling (Zod 400, UNIQUE 409, FK 400, not found 404)
    pagination.ts       # Pagination query parsing (unused in current routes, kept for future)
  validators/
    anime.ts            # Zod schemas for request validation
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
    media.ts            # Zod schemas for presigned upload + confirm
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
- `createRelation` throws `NotFoundError` for both missing source and missing target anime (consistent behavior)
- `listAnime` uses batch queries instead of N+1 per-anime queries
- `getAnimeBySlug` uses a single query (no N+1)
- Genre delete returns 404 if not found (consistent with anime/season delete)
- `updateGenre` checks for duplicate name before update
- Services return snake_case in API responses — `mapXxxRow` helpers convert Drizzle camelCase columns to snake_case
- Relations service `createRelation` returns `mapRelationRow` with snake_case keys
- Genre list endpoint returns `anime_count` (mapped from Drizzle's `animeCount`)
- Anime `getAnimeById` returns `genres` as string array (names only), not objects
- DB tables created via `pushSchema()` function with raw DDL in connection.ts
- Zod validators enforce: `season_year` range 1900–2100, `slug` rejects empty strings (`.string().min(1)`), `listGlobalSeasons` adjusted for consistency
- Services contain business logic, routes are thin handlers that call services
- Hono routes must use full path prefixes (e.g., `/anime/:id` not `/:id`) — `app.route()` does not namespace by sub-app
- All timestamps are ISO strings stored as text in SQLite
- `normalizeVideoSources()` returns `[]` (not `null`) for missing/empty video_url
- `shouldTranscode` supports: mkv, avi, mov, wmv, flv, m4v, mpg, mpeg, 3gp, ogm (in addition to standard formats)
- `thumbnail_url` on anime is a placeholder for R2/bucket image storage (v2)
- Genres are passed as names (strings) in anime create/update, not as IDs. The service resolves names → IDs and auto-creates genres that don't exist.
- Anime status values: airing, finished, not_yet_aired, paused, cancelled

## Database Notes

- SQLite with Drizzle ORM
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`)
- `episodes` table has two unique constraints:
  - `UNIQUE(season_id, episode_number)` for TV series
  - `UNIQUE(anime_id, episode_number) WHERE season_id IS NULL` for OVAs/specials (partial index)
- Cascading deletes with `onDelete: 'cascade'` on all FK relations:
  - anime → seasons → episodes → media (DB only; `deleteAnime` calls `deleteMediaFiles(db, animeId)` first to remove files from R2)
  - anime → anime_genres
  - anime → anime_relations
- `alt_titles` stored as JSON text, not a separate table
- `anime.rating` is the global series rating; `seasons.external_rating` is per-season rating
- `anime.slug` is TEXT NOT NULL UNIQUE — auto-generated from title via `generateSlug()` (lowercase, NFD-normalized, hyphen-joined). If duplicate, appends `-1`, `-2`, etc via `ensureUniqueSlug()` with retry loop (no race condition). Can be overridden on create/update via request body.

## Key Commands

- `bun run dev` — Start dev server with hot reload
- `bun test` — Run tests
- `bun test --watch` — Run tests in watch mode
- `bun run db:generate` — Generate Drizzle migrations
- `bun run db:migrate` — Run migrations
- `bun run db:seed` — Seed the database with sample data

## TMDB Integration

- **API Key**: Stored in `.env` as `TMDB_API_KEY`. Read via `Bun.env.TMDB_API_KEY`.
- **Endpoints**:
  - `GET /api/tmdb/search?query=...&page=1&language=en-US` — Search TV shows on TMDB
  - `GET /api/tmdb/tv/:id?language=en-US` — Get TV detail from TMDB
  - `POST /api/tmdb/import/:id?include_seasons=true&include_episodes=false&language=en-US` — Import anime from TMDB into local DB. Accepts JSON body with `overrides` (`media_type`, `source`, `status`).
- **Service files**: `services/tmdb.ts` (TMDB API client), `services/tmdb-import.ts` (import logic)
- **Mapping**:
  - TMDB `poster_path` → `image_url` (prepends `https://image.tmdb.org/t/p/w500`)
  - TMDB `backdrop_path` → `cover_url` (prepends `https://image.tmdb.org/t/p/original`)
  - TMDB `vote_average` → `rating` (0–10 scale)
  - TMDB `status` → mapped via `mapTMDBStatus()` (e.g., `Ended` → `finished`)
  - TMDB `original_name` → `alt_titles[original_language]` when different from `name`
  - TMDB genres → resolved by name using `/genre/tv/list` (always English names, cached in memory)
  - TMDB `episode_run_time[0]` → `duration`
  - TMDB seasons → created with `season_number`, `episode_count`, `season_year`, `start_date`, `external_rating`
- **Duplicate check**: Import rejects if an anime with the same title already exists (409)
- **Episodes**: Optional (`include_episodes=true`). Fetches each season's episodes from TMDB and creates them with `episode_number`, `title`, `duration`, `air_date`.
- **Language**: TMDB API defaults to `es-ES` when no language param is specified

## Media Storage (R2)

- **Provider**: Cloudflare R2 (S3-compatible)
- **Env vars**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- **Flow**: Browser requests presigned upload URL from backend → uploads directly to R2 via PUT → confirms upload with backend → backend saves reference in `media` table
- **Active transcode tracking**: `activeTranscodes` queries `media.status === 'processing'` directly in DB, not an in-memory Set
- **Streaming**: Download/play redirects work without `content-length` header (streaming mode)
- **Paths**: R2 key format `v/{animeId}/{episodePart}/{lang}/{uuid}.{ext}` — includes animeId, episodeId, lang for organization; no readable filenames, opaque to end user
- **`video_url`** field on episodes still exists for external sources (Crunchyroll, etc.). The `media` table is for self-hosted files.
- **Language codes** in both `video_url` and `media` table: `ja`, `en`, `es`, `es-419`, `es-ES`
- **Schema**: `media` table with `episode_id`, `anime_id`, `key`, `original_name`, `mime_type`, `size_bytes`, `audio` (JSON), `subs` (JSON), `source_name`, `lang`
- **Endpoints**:
  - `POST /api/media/upload-url` — Generate presigned PUT URL for browser upload
  - `POST /api/media/confirm` — Confirm upload, save reference to DB
  - `GET /api/media/episode/:episodeId` — List media for episode (with signed URLs)
  - `GET /api/media/anime/:animeId` — List media for anime (with signed URLs)
  - `GET /api/media/:id/play` — Redirect to signed URL for playback
  - `DELETE /api/media/:id` — Delete media (from DB + R2)

## API Documentation

The API exposes `GET /api/docs` which returns a markdown document describing all endpoints, parameters, and response types. This is designed to be consumed by AI agents — lightweight and always in sync with the codebase.

## V2 Considerations (NOT in scope for v1)

- Auth with JWT
- User ratings (average score per anime)
- Rate limiting by IP
- Full-text search (FTS5)
- Image upload — R2/bucket para almacenar posters/imagenes

## Language

The user communicates in Spanish. Respond in Spanish.

## Important

After making changes — new features, schema changes, new conventions, bug fixes — update this AGENTS.md file to reflect the current state of the project. Keep conventions, database notes, and project structure in sync with what actually exists in the codebase.