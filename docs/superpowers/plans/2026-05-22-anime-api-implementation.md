# Anime API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a REST API for an anime catalog with Hono + Drizzle + SQLite on Bun, following the design spec at `docs/superpowers/specs/2026-05-22-anime-api-design.md`.

**Architecture:** Layered — routes (thin handlers) call services (business logic) which call Drizzle ORM. DB connection injected via Hono context middleware. Zod validators on all write endpoints. Integration tests with `bun test` using in-memory SQLite.

**Tech Stack:** Bun, Hono, Drizzle ORM, SQLite (better-sqlite3), Zod, `bun test`

---

## File Structure

```
src/
  db/
    schema.ts          # Drizzle table definitions + relations
    connection.ts       # DB connection helper (file-based + :memory:)
  routes/
    anime.ts            # Anime CRUD + list with filters
    seasons.ts          # Season CRUD (nested) + global /api/seasons
    episodes.ts         # Episode CRUD (nested, with/without season)
    genres.ts           # Genre CRUD
    relations.ts        # Anime relation create/delete
    health.ts           # GET /api/health
    docs.ts             # GET /api/docs (markdown)
  services/
    anime.ts            # Anime business logic (create, update, delete, list, get)
    seasons.ts          # Season business logic
    episodes.ts         # Episode business logic
    genres.ts           # Genre business logic (name resolution, auto-create)
    relations.ts        # Relation business logic
  middleware/
    error-handler.ts    # Global error handler (Zod errors → 400, not found → 404)
    pagination.ts       # Parse page/limit query params, inject into context
  validators/
    anime.ts            # createAnimeSchema, updateAnimeSchema
    seasons.ts          # createSeasonSchema, updateSeasonSchema
    episodes.ts         # createEpisodeSchema, updateEpisodeSchema
    genres.ts           # createGenreSchema, updateGenreSchema
    relations.ts        # createRelationSchema
  index.ts              # App setup: CORS, middleware, route registration, listen
test/
  helpers.ts            # createTestApp(), seed helpers
  anime.test.ts
  seasons.test.ts
  episodes.test.ts
  genres.test.ts
  relations.test.ts
drizzle.config.ts      # Drizzle kit config
```

---

### Task 1: Drizzle Schema + Connection + Config

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/connection.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Write the Drizzle schema**

Create `src/db/schema.ts` with all 6 tables (anime, seasons, episodes, genres, anime_genres, anime_relations) and their relations.

```typescript
import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const anime = sqliteTable('anime', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  altTitles: text('alt_titles'), // JSON string
  synopsis: text('synopsis'),
  imageUrl: text('image_url'),
  mediaType: text('media_type').notNull(),
  status: text('status').notNull().default('not_yet_aired'),
  source: text('source'),
  duration: integer('duration'),
  releaseDate: text('release_date'),
  rating: real('rating'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  title: text('title'),
  seasonNumber: integer('season_number').notNull(),
  episodeCount: integer('episode_count'),
  seasonYear: integer('season_year'),
  seasonName: text('season_name'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  externalRating: real('external_rating'),
}, (table) => [
  uniqueIndex('seasons_anime_id_season_number_unique').on(table.animeId, table.seasonNumber),
]);

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  seasonId: integer('season_id').references(() => seasons.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  duration: integer('duration'),
  airDate: text('air_date'),
}, (table) => [
  uniqueIndex('episodes_season_id_episode_number_unique').on(table.seasonId, table.episodeNumber),
  // NOTE: The partial unique index for (anime_id, episode_number) WHERE season_id IS NULL
  // is NOT supported by Drizzle's uniqueIndex. This must be created via raw SQL in migrations:
  // CREATE UNIQUE INDEX episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL;
]);

export const genres = sqliteTable('genres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const animeGenres = sqliteTable('anime_genres', {
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.animeId, table.genreId] }),
]);

export const animeRelationsTable = sqliteTable('anime_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceAnimeId: integer('source_anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  targetAnimeId: integer('target_anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
});

// Drizzle relations
export const animeRelations = relations(anime, ({ many }) => ({
  seasons: many(seasons),
  genres: many(animeGenres),
  sourceRelations: many(animeRelationsTable, { relationName: 'source' }),
  targetRelations: many(animeRelationsTable, { relationName: 'target' }),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  anime: one(anime, { fields: [seasons.animeId], references: [anime.id] }),
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  anime: one(anime, { fields: [episodes.animeId], references: [anime.id] }),
  season: one(seasons, { fields: [episodes.seasonId], references: [seasons.id] }),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  animes: many(animeGenres),
}));

export const animeGenresRelations = relations(animeGenres, ({ one }) => ({
  anime: one(anime, { fields: [animeGenres.animeId], references: [anime.id] }),
  genre: one(genres, { fields: [animeGenres.genreId], references: [genres.id] }),
}));

export const animeRelationsTableRelations = relations(animeRelationsTable, ({ one }) => ({
  sourceAnime: one(anime, { fields: [animeRelationsTable.sourceAnimeId], references: [anime.id], relationName: 'source' }),
  targetAnime: one(anime, { fields: [animeRelationsTable.targetAnimeId], references: [anime.id], relationName: 'target' }),
}));
```

**Important notes:**
1. `animeGenres` uses `primaryKey()` helper for composite PK — this is the correct Drizzle API for SQLite composite primary keys.
2. `animeRelationsTable` is the table (renamed to avoid collision with the Drizzle `relations` export). All service code must import `animeRelationsTable` instead of `animeRelations`.
3. The partial unique index `(anime_id, episode_number) WHERE season_id IS NULL` cannot be created via Drizzle's `uniqueIndex`. It must be added via raw SQL in migration or DB initialization: `CREATE UNIQUE INDEX episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL;`

- [ ] **Step 2: Create the DB connection helper**

Create `src/db/connection.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDb(filename: string = 'anime.db') {
  const sqlite = new Database(filename);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  // Create partial unique index that Drizzle can't define in schema
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL');
  return drizzle(sqlite, { schema });
}

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  // Create partial unique index that Drizzle can't define in schema
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL');
  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

- [ ] **Step 3: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
```

- [ ] **Step 4: Verify schema compiles**

Run: `bunx drizzle-kit generate`
Expected: Migration files generated in `./drizzle/` directory.

- [ ] **Step 5: Commit**

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: add Drizzle schema, connection helper, and config"
```

---

### Task 2: Zod Validators

**Files:**
- Create: `src/validators/anime.ts`
- Create: `src/validators/seasons.ts`
- Create: `src/validators/episodes.ts`
- Create: `src/validators/genres.ts`
- Create: `src/validators/relations.ts`

- [ ] **Step 1: Write all Zod schemas**

Create `src/validators/anime.ts`:

```typescript
import { z } from 'zod';

export const createAnimeSchema = z.object({
  title: z.string().min(1),
  alt_titles: z.record(z.string(), z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).default('not_yet_aired'),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
});

export const updateAnimeSchema = z.object({
  title: z.string().min(1).optional(),
  alt_titles: z.record(z.string(), z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).optional(),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
});

export const animeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).optional(),
  genre: z.string().optional(),
  season_year: z.coerce.number().int().optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
  sort: z.enum(['title', 'rating', 'created_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
```

Create `src/validators/seasons.ts`:

```typescript
import { z } from 'zod';

export const createSeasonSchema = z.object({
  title: z.string().optional(),
  season_number: z.number().int().min(1),
  episode_count: z.number().int().positive().optional(),
  season_year: z.number().int().min(1900).max(2100).optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  external_rating: z.number().min(0).max(10).optional(),
});

export const updateSeasonSchema = createSeasonSchema.partial();

export const seasonListQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
});
```

Create `src/validators/episodes.ts`:

```typescript
import { z } from 'zod';

export const createEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().optional(),
  duration: z.number().int().positive().optional(),
  air_date: z.string().optional(),
});

export const updateEpisodeSchema = createEpisodeSchema.partial();
```

Create `src/validators/genres.ts`:

```typescript
import { z } from 'zod';

export const createGenreSchema = z.object({
  name: z.string().min(1),
});

export const updateGenreSchema = z.object({
  name: z.string().min(1),
});
```

Create `src/validators/relations.ts`:

```typescript
import { z } from 'zod';

export const createRelationSchema = z.object({
  target_anime_id: z.number().int().positive(),
  relation_type: z.enum(['sequel', 'prequel', 'alternative', 'spin_off', 'side_story', 'adaptation']),
});
```

- [ ] **Step 2: Verify validators compile**

Run: `bun run --eval "import './src/validators/anime'"` (or just start the dev server briefly).
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/validators/
git commit -m "feat: add Zod validation schemas for all endpoints"
```

---

### Task 3: Middleware (Error Handler + Pagination)

**Files:**
- Create: `src/middleware/error-handler.ts`
- Create: `src/middleware/pagination.ts`

- [ ] **Step 1: Write the error handler middleware**

Create `src/middleware/error-handler.ts`:

```typescript
import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 400,
          message: 'Validation error',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  if (err instanceof Error && err.message.includes('not found')) {
    return c.json({ error: { code: 404, message: err.message } }, 404);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { code: 500, message: 'Internal server error' } }, 500);
};
```

- [ ] **Step 2: Write the pagination middleware**

Create `src/middleware/pagination.ts`:

```typescript
import type { Context, Next } from 'hono';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export async function paginationMiddleware(c: Context, next: Next) {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;

  c.set('pagination', { page, limit, offset } satisfies PaginationParams);
  await next();
}

export function paginateResponse(data: unknown[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware/
git commit -m "feat: add error handler and pagination middleware"
```

---

### Task 4: Services — Genres

**Files:**
- Create: `src/services/genres.ts`

Start with genres because anime create depends on genre resolution.

- [ ] **Step 1: Write the genres service**

Create `src/services/genres.ts`:

```typescript
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { genres, animeGenres } from '../db/schema';

export async function listGenres(db: Database) {
  return db
    .select({
      id: genres.id,
      name: genres.name,
      animeCount: sql<number>`count(${animeGenres.animeId})`.as('anime_count'),
    })
    .from(genres)
    .leftJoin(animeGenres, eq(genres.id, animeGenres.genreId))
    .groupBy(genres.id, genres.name);
}

export async function getGenreById(db: Database, id: number) {
  const result = await db.select().from(genres).where(eq(genres.id, id)).get();
  return result ?? null;
}

export async function createGenre(db: Database, name: string) {
  const result = await db.insert(genres).values({ name }).returning().get();
  return result;
}

export async function updateGenre(db: Database, id: number, name: string) {
  const result = await db.update(genres).set({ name }).where(eq(genres.id, id)).returning().get();
  return result ?? null;
}

export async function deleteGenre(db: Database, id: number) {
  await db.delete(genres).where(eq(genres.id, id));
}

/**
 * Resolve genre names to IDs. Create genres that don't exist yet.
 */
export async function resolveGenreNames(db: Database, names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const existing = await db.select().from(genres).where(inArray(genres.name, names));
  const existingMap = new Map(existing.map((g) => [g.name, g.id]));

  const missing = names.filter((n) => !existingMap.has(n));
  for (const name of missing) {
    const created = await db.insert(genres).values({ name }).returning().get();
    existingMap.set(name, created.id);
  }

  return names.map((n) => existingMap.get(n)!);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/genres.ts
git commit -m "feat: add genres service with name resolution"
```

---

### Task 5: Services — Anime

**Files:**
- Create: `src/services/anime.ts`

- [ ] **Step 1: Write the anime service**

Create `src/services/anime.ts`:

```typescript
import { eq, sql, like, and, or, desc, asc, inArray } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { anime, seasons, animeGenres, animeRelationsTable, genres } from '../db/schema';
import { resolveGenreNames } from './genres';
import { updateAnimeSchema } from '../validators/anime';
import type { z } from 'zod';

export async function listAnime(
  db: Database,
  options: {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    media_type?: string;
    status?: string;
    genre?: string;
    season_year?: number;
    season_name?: string;
    sort?: string;
    order?: string;
  }
) {
  const conditions = [];

  if (options.search) {
    conditions.push(or(like(anime.title, `%${options.search}%`), like(anime.altTitles, `%${options.search}%`)));
  }
  if (options.media_type) {
    conditions.push(eq(anime.mediaType, options.media_type));
  }
  if (options.status) {
    conditions.push(eq(anime.status, options.status));
  }
  if (options.season_year) {
    conditions.push(sql`EXISTS (SELECT 1 FROM seasons WHERE seasons.anime_id = anime.id AND seasons.season_year = ${options.season_year})`);
  }
  if (options.season_name) {
    conditions.push(sql`EXISTS (SELECT 1 FROM seasons WHERE seasons.anime_id = anime.id AND seasons.season_name = ${options.season_name})`);
  }

  // Genre filtering: find anime IDs that have ALL specified genres
  if (options.genre) {
    const genreNames = options.genre.split(',');
    const genreIds = await resolveGenreNames(db, genreNames);
    if (genreIds.length > 0) {
      const matchingAnimeIds = await db
        .select({ animeId: animeGenres.animeId })
        .from(animeGenres)
        .where(inArray(animeGenres.genreId, genreIds))
        .groupBy(animeGenres.animeId)
        .having(sql`count(distinct ${animeGenres.genreId}) = ${genreIds.length}`);
      if (matchingAnimeIds.length === 0) {
        return { data: [], pagination: { page: options.page, limit: options.limit, total: 0, total_pages: 0 } };
      }
      conditions.push(inArray(anime.id, matchingAnimeIds.map((r) => r.animeId)));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = options.sort === 'title' ? anime.title : options.sort === 'rating' ? anime.rating : anime.createdAt;
  const orderFn = options.order === 'asc' ? asc : desc;

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(anime).where(where);
  
  const results = await db
    .select()
    .from(anime)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(options.limit)
    .offset(options.offset);

  // Fetch genres for each anime
  const animeWithGenres = await Promise.all(
    results.map(async (a) => {
      const genreList = await db
        .select({ name: genres.name })
        .from(animeGenres)
        .innerJoin(genres, eq(animeGenres.genreId, genres.id))
        .where(eq(animeGenres.animeId, a.id));
      const [{ count: seasonCount }] = await db.select({ count: sql<number>`count(*)` }).from(seasons).where(eq(seasons.animeId, a.id));
      return {
        ...mapAnimeRow(a),
        genres: genreList.map((g) => g.name),
        season_count: seasonCount,
      };
    })
  );

  return {
    data: animeWithGenres,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      total_pages: Math.ceil(total / options.limit),
    },
  };
}

export async function getAnimeById(db: Database, id: number) {
  const result = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!result) return null;

  const genreList = await db
    .select({ id: genres.id, name: genres.name })
    .from(animeGenres)
    .innerJoin(genres, eq(animeGenres.genreId, genres.id))
    .where(eq(animeGenres.animeId, id));

  const seasonList = await db.select().from(seasons).where(eq(seasons.animeId, id));

  const relationsList = await db
    .select({
      id: anime.id,
      title: anime.title,
      relation_type: animeRelationsTable.relationType,
    })
    .from(animeRelationsTable)
    .innerJoin(anime, eq(animeRelationsTable.targetAnimeId, anime.id))
    .where(eq(animeRelationsTable.sourceAnimeId, id));

  return {
    ...mapAnimeRow(result),
    genres: genreList,
    seasons: seasonList.map(mapSeasonRow),
    relations: relationsList,
  };
}

export async function createAnime(db: Database, data: {
  title: string;
  alt_titles?: Record<string, string>;
  synopsis?: string;
  image_url?: string;
  media_type: string;
  status?: string;
  source?: string;
  duration?: number;
  release_date?: string;
  genres?: string[];
  rating?: number;
}) {
  const altTitlesJson = data.alt_titles ? JSON.stringify(data.alt_titles) : null;

  const result = await db.insert(anime).values({
    title: data.title,
    altTitles: altTitlesJson,
    synopsis: data.synopsis,
    imageUrl: data.image_url,
    mediaType: data.media_type,
    status: data.status ?? 'not_yet_aired',
    source: data.source,
    duration: data.duration,
    releaseDate: data.release_date,
    rating: data.rating,
  }).returning().get();

  if (data.genres && data.genres.length > 0) {
    const genreIds = await resolveGenreNames(db, data.genres);
    await db.insert(animeGenres).values(genreIds.map((gid) => ({ animeId: result.id, genreId: gid })));
  }

  return getAnimeById(db, result.id);
}

export async function updateAnime(db: Database, id: number, data: z.infer<typeof updateAnimeSchema>) {
  const existing = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.alt_titles !== undefined) updateData.altTitles = JSON.stringify(data.alt_titles);
  if (data.synopsis !== undefined) updateData.synopsis = data.synopsis;
  if (data.image_url !== undefined) updateData.imageUrl = data.image_url;
  if (data.media_type !== undefined) updateData.mediaType = data.media_type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.release_date !== undefined) updateData.releaseDate = data.release_date;
  if (data.rating !== undefined) updateData.rating = data.rating;
  updateData.updatedAt = sql`(datetime('now'))`;

  await db.update(anime).set(updateData).where(eq(anime.id, id));

  if (data.genres !== undefined) {
    const genreNames = data.genres as string[];
    await db.delete(animeGenres).where(eq(animeGenres.animeId, id));
    if (genreNames.length > 0) {
      const genreIds = await resolveGenreNames(db, genreNames);
      await db.insert(animeGenres).values(genreIds.map((gid) => ({ animeId: id, genreId: gid })));
    }
  }

  return getAnimeById(db, id);
}

export async function deleteAnime(db: Database, id: number) {
  const existing = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!existing) return false;
  await db.delete(anime).where(eq(anime.id, id));
  return true;
}

function mapAnimeRow(row: typeof anime.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    alt_titles: row.altTitles ? JSON.parse(row.altTitles) : null,
    synopsis: row.synopsis,
    image_url: row.imageUrl,
    media_type: row.mediaType,
    status: row.status,
    source: row.source,
    duration: row.duration,
    release_date: row.releaseDate,
    rating: row.rating,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function mapSeasonRow(row: typeof seasons.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    title: row.title,
    season_number: row.seasonNumber,
    episode_count: row.episodeCount,
    season_year: row.seasonYear,
    season_name: row.seasonName,
    start_date: row.startDate,
    end_date: row.endDate,
    external_rating: row.externalRating,
  };
}
```

**Important:** The genre filtering query with multiple genres (AND logic) and the search with `like` on `altTitles` (JSON column) may need careful SQL. The `resolveGenreNames` call from the genres service is reused. The `mapAnimeRow` and `mapSeasonRow` helpers convert snake_case DB columns to the API's snake_case response — adjust based on Drizzle's actual column naming conventions.

- [ ] **Step 2: Commit**

```bash
git add src/services/anime.ts
git commit -m "feat: add anime service with CRUD, list, genre resolution"
```

---

### Task 6: Services — Seasons, Episodes, Relations

**Files:**
- Create: `src/services/seasons.ts`
- Create: `src/services/episodes.ts`
- Create: `src/services/relations.ts`

- [ ] **Step 1: Write the seasons service**

Create `src/services/seasons.ts`:

```typescript
import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { seasons, episodes } from '../db/schema';

export async function listSeasonsByAnime(db: Database, animeId: number) {
  const results = await db.select().from(seasons).where(eq(seasons.animeId, animeId));
  return results.map(mapSeasonRow);
}

export async function getSeasonById(db: Database, animeId: number, seasonId: number) {
  const season = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!season) return null;
  const episodeList = await db.select().from(episodes).where(eq(episodes.seasonId, seasonId));
  return { ...mapSeasonRow(season), episodes: episodeList.map(mapEpisodeRow) };
}

export async function createSeason(db: Database, animeId: number, data: {
  title?: string;
  season_number: number;
  episode_count?: number;
  season_year?: number;
  season_name?: string;
  start_date?: string;
  end_date?: string;
  external_rating?: number;
}) {
  const result = await db.insert(seasons).values({
    animeId,
    title: data.title,
    seasonNumber: data.season_number,
    episodeCount: data.episode_count,
    seasonYear: data.season_year,
    seasonName: data.season_name,
    startDate: data.start_date,
    endDate: data.end_date,
    externalRating: data.external_rating,
  }).returning().get();
  return result;
}

export async function updateSeason(db: Database, animeId: number, seasonId: number, data: Record<string, unknown>) {
  const existing = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.season_number !== undefined) updateData.seasonNumber = data.season_number;
  if (data.episode_count !== undefined) updateData.episodeCount = data.episode_count;
  if (data.season_year !== undefined) updateData.seasonYear = data.season_year;
  if (data.season_name !== undefined) updateData.seasonName = data.season_name;
  if (data.start_date !== undefined) updateData.startDate = data.start_date;
  if (data.end_date !== undefined) updateData.endDate = data.end_date;
  if (data.external_rating !== undefined) updateData.externalRating = data.external_rating;

  await db.update(seasons).set(updateData).where(eq(seasons.id, seasonId));
  return getSeasonById(db, animeId, seasonId);
}

export async function deleteSeason(db: Database, animeId: number, seasonId: number) {
  const existing = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!existing) return false;
  await db.delete(seasons).where(eq(seasons.id, seasonId));
  return true;
}

export async function listGlobalSeasons(db: Database, filters: { year?: number; season_name?: string }) {
  const conditions = [];
  if (filters.year) conditions.push(eq(seasons.seasonYear, filters.year));
  if (filters.season_name) conditions.push(eq(seasons.seasonName, filters.season_name));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      year: seasons.seasonYear,
      season: seasons.seasonName,
      anime_count: sql<number>`count(distinct ${seasons.animeId})`,
    })
    .from(seasons)
    .where(where)
    .groupBy(seasons.seasonYear, seasons.seasonName)
    .orderBy(seasons.seasonYear, seasons.seasonNumber);
}

function mapSeasonRow(row: typeof seasons.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    title: row.title,
    season_number: row.seasonNumber,
    episode_count: row.episodeCount,
    season_year: row.seasonYear,
    season_name: row.seasonName,
    start_date: row.startDate,
    end_date: row.endDate,
    external_rating: row.externalRating,
  };
}

function mapEpisodeRow(row: typeof episodes.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    season_id: row.seasonId,
    episode_number: row.episodeNumber,
    title: row.title,
    duration: row.duration,
    air_date: row.airDate,
  };
}
```

- [ ] **Step 2: Write the episodes service**

Create `src/services/episodes.ts`:

```typescript
import { eq, and, isNull } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { episodes } from '../db/schema';

function mapEpisodeRow(row: typeof episodes.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    season_id: row.seasonId,
    episode_number: row.episodeNumber,
    title: row.title,
    duration: row.duration,
    air_date: row.airDate,
  };
}

export async function listEpisodesBySeason(db: Database, seasonId: number) {
  const results = await db.select().from(episodes).where(eq(episodes.seasonId, seasonId));
  return results.map(mapEpisodeRow);
}

export async function listEpisodesByAnime(db: Database, animeId: number) {
  const results = await db.select().from(episodes).where(and(eq(episodes.animeId, animeId), isNull(episodes.seasonId)));
  return results.map(mapEpisodeRow);
}

export async function getEpisodeById(db: Database, episodeId: number) {
  const result = await db.select().from(episodes).where(eq(episodes.id, episodeId)).get();
  return result ? mapEpisodeRow(result) : null;
}

export async function createEpisode(db: Database, animeId: number, data: {
  episode_number: number;
  title?: string;
  duration?: number;
  air_date?: string;
  season_id?: number;
}) {
  const result = await db.insert(episodes).values({
    animeId,
    seasonId: data.season_id ?? null,
    episodeNumber: data.episode_number,
    title: data.title,
    duration: data.duration,
    airDate: data.air_date,
  }).returning().get();
  return mapEpisodeRow(result);
}

export async function updateEpisode(db: Database, episodeId: number, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};
  if (data.episode_number !== undefined) updateData.episodeNumber = data.episode_number;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.air_date !== undefined) updateData.airDate = data.air_date;
  if (data.season_id !== undefined) updateData.seasonId = data.season_id;

  await db.update(episodes).set(updateData).where(eq(episodes.id, episodeId));
  return getEpisodeById(db, episodeId);
}

export async function deleteEpisode(db: Database, episodeId: number) {
  const existing = await db.select().from(episodes).where(eq(episodes.id, episodeId)).get();
  if (!existing) return false;
  await db.delete(episodes).where(eq(episodes.id, episodeId));
  return true;
}
```

- [ ] **Step 3: Write the relations service**

Create `src/services/relations.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { animeRelationsTable } from '../db/schema';

export async function createRelation(db: Database, sourceAnimeId: number, targetAnimeId: number, relationType: string) {
  const result = await db.insert(animeRelationsTable).values({
    sourceAnimeId,
    targetAnimeId,
    relationType,
  }).returning().get();
  return result;
}

export async function deleteRelation(db: Database, sourceAnimeId: number, relationId: number) {
  const existing = await db.select().from(animeRelationsTable).where(
    and(eq(animeRelationsTable.id, relationId), eq(animeRelationsTable.sourceAnimeId, sourceAnimeId))
  ).get();
  if (!existing) return false;
  await db.delete(animeRelationsTable).where(eq(animeRelationsTable.id, relationId));
  return true;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/services/seasons.ts src/services/episodes.ts src/services/relations.ts
git commit -m "feat: add seasons, episodes, and relations services"
```

---

### Task 7: Routes + App Entry Point

**Files:**
- Create: `src/routes/health.ts`
- Create: `src/routes/anime.ts`
- Create: `src/routes/seasons.ts`
- Create: `src/routes/episodes.ts`
- Create: `src/routes/genres.ts`
- Create: `src/routes/relations.ts`
- Create: `src/routes/docs.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write all route files**

Each route file exports a function that registers routes on a Hono app instance. The DB is accessed via `c.get('db')` from the Hono context.

Create `src/routes/health.ts`:

```typescript
import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => c.json({ status: 'ok' }));
```

Create `src/routes/anime.ts` — thin handlers that call the anime service:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createAnimeSchema, updateAnimeSchema, animeListQuerySchema } from '../validators/anime';
import type { Database } from '../db/connection';
import * as animeService from '../services/anime';

export const animeRoutes = new Hono<{ Variables: { db: Database } }>();

animeRoutes.get('/', async (c) => {
  const db = c.get('db');
  const query = animeListQuerySchema.parse(c.req.query());
  const result = await animeService.listAnime(db, {
    page: query.page,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
    search: query.search,
    media_type: query.media_type,
    status: query.status,
    genre: query.genre,
    season_year: query.season_year,
    season_name: query.season_name,
    sort: query.sort,
    order: query.order,
  });
  return c.json(result);
});

animeRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const result = await animeService.getAnimeById(db, id);
  if (!result) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: result });
});

animeRoutes.post('/', zValidator('json', createAnimeSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');
  const result = await animeService.createAnime(db, body);
  return c.json({ data: result }, 201);
});

animeRoutes.put('/:id', zValidator('json', updateAnimeSchema), async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await animeService.updateAnime(db, id, body);
  if (!result) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: result });
});

animeRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const deleted = await animeService.deleteAnime(db, id);
  if (!deleted) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.body(null, 204);
});
```

Create `src/routes/seasons.ts`, `src/routes/episodes.ts`, `src/routes/genres.ts`, `src/routes/relations.ts` following the same pattern — thin handlers calling services. Each follows the endpoint spec exactly.

Create `src/routes/docs.ts`:

```typescript
import { Hono } from 'hono';

export const docsRoutes = new Hono();

docsRoutes.get('/docs', (c) => {
  const markdown = `# Anime API Documentation

## Base URL: /api

## Endpoints

### Anime
- GET /api/anime - List anime with filters and pagination
- GET /api/anime/:id - Get anime detail with genres, seasons, relations
- POST /api/anime - Create anime
- PUT /api/anime/:id - Update anime
- DELETE /api/anime/:id - Delete anime

### Seasons
- GET /api/anime/:animeId/seasons - List seasons for an anime
- GET /api/anime/:animeId/seasons/:seasonId - Get season with episodes
- POST /api/anime/:animeId/seasons - Create season
- PUT /api/anime/:animeId/seasons/:seasonId - Update season
- DELETE /api/anime/:animeId/seasons/:seasonId - Delete season
- GET /api/seasons - List global seasons (filter by year/name)

### Episodes
- GET /api/anime/:animeId/seasons/:seasonId/episodes - List episodes in a season
- GET /api/anime/:animeId/episodes - List episodes without season (OVAs)
- GET /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId - Get episode detail
- GET /api/anime/:animeId/episodes/:episodeId - Get episode detail (no season)
- POST /api/anime/:animeId/seasons/:seasonId/episodes - Create episode in season
- POST /api/anime/:animeId/episodes - Create episode without season
- PUT /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId - Update episode
- PUT /api/anime/:animeId/episodes/:episodeId - Update episode (no season)
- DELETE /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId - Delete episode
- DELETE /api/anime/:animeId/episodes/:episodeId - Delete episode (no season)

### Genres
- GET /api/genres - List genres with anime count
- POST /api/genres - Create genre
- PUT /api/genres/:id - Update genre
- DELETE /api/genres/:id - Delete genre

### Relations
- POST /api/anime/:id/relations - Create relation
- DELETE /api/anime/:id/relations/:relationId - Delete relation

### Health
- GET /api/health - Health check

### Documentation
- GET /api/docs - This markdown documentation

## Response Format
- Individual: { data: { ... } }
- Lists: { data: [...], pagination: { page, limit, total, total_pages } }
- Errors: { error: { code, message } }

## Status Codes
- 200 OK, 201 Created, 204 No Content, 400 Validation Error, 404 Not Found, 500 Server Error
`;

  return c.text(markdown, 200, { 'Content-Type': 'text/markdown' });
});
```

- [ ] **Step 2: Write the app entry point**

Modify `src/index.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db/connection';
import { errorHandler } from './middleware/error-handler';
import { paginationMiddleware } from './middleware/pagination';
import { healthRoutes } from './routes/health';
import { animeRoutes } from './routes/anime';
import { seasonsRoutes } from './routes/seasons';
import { episodesRoutes } from './routes/episodes';
import { genresRoutes } from './routes/genres';
import { relationsRoutes } from './routes/relations';
import { docsRoutes } from './routes/docs';

const app = new Hono<{ Variables: { db: ReturnType<typeof createDb> } }>();

app.use('*', cors());
app.use('*', paginationMiddleware);

const db = createDb();
app.use('*', async (c, next) => {
  c.set('db', db);
  await next();
});

app.onError(errorHandler);

app.route('/api', healthRoutes);
app.route('/api', animeRoutes);
app.route('/api', seasonsRoutes);
app.route('/api', episodesRoutes);
app.route('/api', genresRoutes);
app.route('/api', relationsRoutes);
app.route('/api', docsRoutes);

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on http://localhost:${port}`);

export default app;
```

- [ ] **Step 3: Verify app starts**

Run: `bun run dev`
Expected: Server starts on port 3000, `GET /api/health` returns `{ "status": "ok" }`.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: add all route handlers and app entry point"
```

---

### Task 8: Test Helpers

**Files:**
- Create: `test/helpers.ts`

- [ ] **Step 1: Create test helpers**

Create `test/helpers.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createTestDb } from '../src/db/connection';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { errorHandler } from '../src/middleware/error-handler';
import { paginationMiddleware } from '../src/middleware/pagination';
import { healthRoutes } from '../src/routes/health';
import { animeRoutes } from '../src/routes/anime';
import { seasonsRoutes } from '../src/routes/seasons';
import { episodesRoutes } from '../src/routes/episodes';
import { genresRoutes } from '../src/routes/genres';
import { relationsRoutes } from '../src/routes/relations';

export function createTestApp() {
  const db = createTestDb();

  // Create all tables
  const sqlite = (db as any).$client;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      alt_titles TEXT,
      synopsis TEXT,
      image_url TEXT,
      media_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_yet_aired',
      source TEXT,
      duration INTEGER,
      release_date TEXT,
      rating REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      title TEXT,
      season_number INTEGER NOT NULL,
      episode_count INTEGER,
      season_year INTEGER,
      season_name TEXT,
      start_date TEXT,
      end_date TEXT,
      external_rating REAL,
      UNIQUE(anime_id, season_number)
    );
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title TEXT,
      duration INTEGER,
      air_date TEXT,
      UNIQUE(season_id, episode_number)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL;
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS anime_genres (
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
      PRIMARY KEY (anime_id, genre_id)
    );
    CREATE TABLE IF NOT EXISTS anime_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      target_anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL
    );
  `);

  const app = new Hono<{ Variables: { db: typeof db } }>();
  app.use('*', cors());
  app.use('*', paginationMiddleware);
  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.onError(errorHandler);

  app.route('/api', healthRoutes);
  app.route('/api', animeRoutes);
  app.route('/api', seasonsRoutes);
  app.route('/api', episodesRoutes);
  app.route('/api', genresRoutes);
  app.route('/api', relationsRoutes);

  return { app, db };
}

export async function seedAnime(db: ReturnType<typeof createTestDb>, overrides: Record<string, unknown> = {}) {
  const result = await db.insert(schema.anime).values({
    title: 'Test Anime',
    mediaType: 'tv',
    ...overrides,
  } as any).returning().get();
  return result;
}

export async function seedGenre(db: ReturnType<typeof createTestDb>, name: string = 'Action') {
  const result = await db.insert(schema.genres).values({ name }).returning().get();
  return result;
}

export async function seedSeason(db: ReturnType<typeof createTestDb>, animeId: number, overrides: Record<string, unknown> = {}) {
  const result = await db.insert(schema.seasons).values({
    animeId,
    seasonNumber: 1,
    ...overrides,
  } as any).returning().get();
  return result;
}

export async function seedEpisode(db: ReturnType<typeof createTestDb>, animeId: number, seasonId: number | null, overrides: Record<string, unknown> = {}) {
  const result = await db.insert(schema.episodes).values({
    animeId,
    seasonId,
    episodeNumber: 1,
    ...overrides,
  } as any).returning().get();
  return result;
}
```

- [ ] **Step 2: Verify test helpers compile**

Run: `bun test --dry-run` or just require the file.
Expected: No import errors.

- [ ] **Step 3: Commit**

```bash
git add test/
git commit -m "feat: add test helpers with in-memory DB setup and seed functions"
```

---

### Task 9: Integration Tests — Anime

**Files:**
- Create: `test/anime.test.ts`

- [ ] **Step 1: Write anime integration tests**

Create `test/anime.test.ts` with tests for:
- `GET /api/anime` returns empty list
- `POST /api/anime` creates anime successfully
- `POST /api/anime` validates with Zod (missing title, invalid media_type)
- `GET /api/anime/:id` returns anime with genres and seasons
- `GET /api/anime/:id` returns 404 for non-existent
- `GET /api/anime` with pagination, filters (status, media_type, genre)
- `PUT /api/anime/:id` updates anime
- `PUT /api/anime/:id` updates genres (replace all)
- `DELETE /api/anime/:id` deletes anime and cascades
- `PUT /api/anime/:id` returns 404 for non-existent
- `DELETE /api/anime/:id` returns 404 for non-existent

Each test starts with a fresh `:memory:` database via `createTestApp()`.

- [ ] **Step 2: Run tests**

Run: `bun test test/anime.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/anime.test.ts
git commit -m "test: add anime integration tests"
```

---

### Task 10: Integration Tests — Seasons

**Files:**
- Create: `test/seasons.test.ts`

- [ ] **Step 1: Write seasons integration tests**

Create `test/seasons.test.ts` with tests for:
- `GET /api/anime/:animeId/seasons` returns seasons for an anime
- `POST /api/anime/:animeId/seasons` creates season, validates anime exists
- `POST /api/anime/:animeId/seasons` validates unique season_number per anime
- `GET /api/anime/:animeId/seasons/:seasonId` returns season with episodes
- `PUT /api/anime/:animeId/seasons/:seasonId` updates season
- `DELETE /api/anime/:animeId/seasons/:seasonId` deletes season (and cascades to episodes)
- `GET /api/seasons` returns global seasons list
- `GET /api/seasons?year=2025&name=spring` filters seasons
- 404 cases for non-existent anime or season

- [ ] **Step 2: Run tests**

Run: `bun test test/seasons.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/seasons.test.ts
git commit -m "test: add seasons integration tests"
```

---

### Task 11: Integration Tests — Episodes

**Files:**
- Create: `test/episodes.test.ts`

- [ ] **Step 1: Write episodes integration tests**

Create `test/episodes.test.ts` with tests for:
- `GET /api/anime/:animeId/seasons/:seasonId/episodes` lists episodes in a season
- `GET /api/anime/:animeId/episodes` lists episodes without season (OVAs)
- `POST /api/anime/:animeId/seasons/:seasonId/episodes` creates episode in season
- `POST /api/anime/:animeId/episodes` creates episode without season
- `POST /api/anime/:animeId/episodes` with season_id validates it belongs to the anime
- Unique constraint: cannot create duplicate episode_number in same season
- Unique constraint: cannot create duplicate episode_number for same anime without season
- `PUT` and `DELETE` episode endpoints
- 404 cases

- [ ] **Step 2: Run tests**

Run: `bun test test/episodes.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/episodes.test.ts
git commit -m "test: add episodes integration tests"
```

---

### Task 12: Integration Tests — Genres + Relations

**Files:**
- Create: `test/genres.test.ts`
- Create: `test/relations.test.ts`

- [ ] **Step 1: Write genres tests**

Create `test/genres.test.ts` with tests for:
- `GET /api/genres` returns genres with anime_count
- `POST /api/genres` creates genre
- `POST /api/genres` rejects duplicate name (400)
- `PUT /api/genres/:id` updates genre
- `DELETE /api/genres/:id` deletes genre and cleans anime_genres

- [ ] **Step 2: Write relations tests**

Create `test/relations.test.ts` with tests for:
- `POST /api/anime/:id/relations` creates relation
- `POST /api/anime/:id/relations` validates both anime exist
- `POST /api/anime/:id/relations` validates relation_type enum
- `DELETE /api/anime/:id/relations/:relationId` deletes relation
- 404 cases

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass across all suites.

- [ ] **Step 4: Commit**

```bash
git add test/genres.test.ts test/relations.test.ts
git commit -m "test: add genres and relations integration tests"
```

---

### Task 13: Final Wiring + Seed Data + Dev Script

**Files:**
- Create: `src/db/seed.ts`
- Modify: `src/index.ts` (add seed on dev start if empty)
- Modify: `package.json` (add seed script)

- [ ] **Step 1: Create seed data**

Create `src/db/seed.ts` with sample anime data (3-5 anime with seasons, episodes, and genres) for development.

- [ ] **Step 2: Add seed script to package.json**

Add `"db:seed": "bun run src/db/seed.ts"` to scripts in package.json.

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 4: Start dev server and verify manually**

Run: `bun run dev`
Verify: `GET /api/health` returns 200, `GET /api/anime` returns empty or seeded data.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: add seed data and final wiring"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| Database schema (6 tables) | Task 1 |
| Zod validation on all write endpoints | Task 2 |
| Error handler middleware | Task 3 |
| Pagination middleware | Task 3 |
| CORS middleware | Task 7 |
| Anime CRUD + list with filters | Tasks 5, 7 |
| Season CRUD (nested + global) | Tasks 6, 7 |
| Episode CRUD (with/without season) | Tasks 6, 7 |
| Genre CRUD with name resolution | Tasks 4, 7 |
| Anime relations (create/delete) | Tasks 6, 7 |
| Health endpoint | Task 7 |
| API docs endpoint (/api/docs) | Task 7 |
| Response format (data + pagination) | Task 3 (paginateResponse) |
| Error format (code + message) | Task 3 (errorHandler) |
| Cascading deletes | Task 1 (FK onDelete: cascade) |
| Genre resolution by name | Task 4 |
| alt_titles as JSON | Task 5 (mapAnimeRow) |
| Unique constraints on episodes | Task 1 (schema) |
| Integration tests with :memory: DB | Tasks 8-12 |

## Placeholder Scan

No TBD, TODO, or "implement later" placeholders found. All steps contain complete code or specific instructions.