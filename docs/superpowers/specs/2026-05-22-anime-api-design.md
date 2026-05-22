# Anime API — Design Spec

## Overview

REST API para catálogo de anime, construida con Hono + Drizzle + SQLite, corriendo en Bun nativo. Consumible externamente por web y mobile. Sin auth en v1.

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Bun (nativo) |
| Framework | Hono |
| Base de datos | SQLite |
| ORM | Drizzle |
| Validación | Zod |
| Testing | Bun test + SQLite `:memory:` |

## Estructura del proyecto

```
src/
  db/
    schema.ts        # Drizzle schema definitions
    connection.ts     # DB connection + migration setup
    seed.ts           # Seed data for development
  routes/
    anime.ts          # Anime endpoints
    seasons.ts        # Season endpoints (nested under anime + global)
    episodes.ts       # Episode endpoints (nested under anime/seasons)
    genres.ts         # Genre CRUD
    relations.ts      # Anime relation endpoints
    health.ts         # Health check
  services/
    anime.ts          # Anime business logic
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
  middleware/
    error-handler.ts  # Global error handling
    pagination.ts     # Pagination query parsing
  validators/
    anime.ts          # Zod schemas for request validation
    seasons.ts
    episodes.ts
    genres.ts
    relations.ts
  index.ts            # App entry point
test/
  helpers.ts          # Test DB setup, app instance, seed helpers
  anime.test.ts
  seasons.test.ts
  episodes.test.ts
  genres.test.ts
  relations.test.ts
```

## Database Schema

### `anime`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| title | text | NOT NULL | Título principal de display |
| alt_titles | text | JSON | `{"japanese": "...", "english": "...", ...}` |
| synopsis | text | | Sinopsis/descripción |
| image_url | text | | URL del poster |
| media_type | text | NOT NULL | tv, movie, ova, ona, special |
| status | text | NOT NULL, default 'not_yet_aired' | airing, finished, not_yet_aired, paused, cancelled |
| source | text | | manga, light_novel, original, game, etc. |
| duration | integer | | Minutos totales (para películas, specials) |
| release_date | text | ISO date | Fecha para lo que no tiene temporadas |
| rating | real | | Rating global de la serie (IMDb/TMDB/AniList) |
| created_at | text | NOT NULL, default now | ISO timestamp |
| updated_at | text | NOT NULL, default now | ISO timestamp |

### `seasons`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| anime_id | integer | FK -> anime.id, NOT NULL | |
| title | text | | "One Punch Man Season 2" |
| season_number | integer | NOT NULL | 1, 2, 3... |
| episode_count | integer | | Total episodios de la temporada |
| season_year | integer | | Año de emisión |
| season_name | text | | winter, spring, summer, fall |
| start_date | text | ISO date | |
| end_date | text | ISO date | |
| external_rating | real | | Rating externo de la temporada (IMDb/TMDB/AniList) |
| | | UNIQUE(anime_id, season_number) | |

### `episodes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| anime_id | integer | FK -> anime.id, NOT NULL | Siempre presente |
| season_id | integer | FK -> seasons.id, nullable | Solo para series de TV |
| episode_number | integer | NOT NULL | 1, 2, 3... |
| title | text | | Título del episodio |
| duration | integer | | Minutos |
| air_date | text | ISO date | |

**Unique constraints:**
- `UNIQUE(season_id, episode_number)` — no duplicar número dentro de una temporada
- `UNIQUE(anime_id, episode_number) WHERE season_id IS NULL` — no duplicar número dentro de un anime sin temporada (OVAs, specials)

### `genres`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| name | text | NOT NULL, UNIQUE | Action, Romance, Mecha... |

### `anime_genres`

| Column | Type | Constraints | Description |
|---|---|---|---|
| anime_id | integer | FK -> anime.id | |
| genre_id | integer | FK -> genres.id | |
| | | PK(anime_id, genre_id) | |

### `anime_relations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| source_anime_id | integer | FK -> anime.id | El anime que tiene la relación |
| target_anime_id | integer | FK -> anime.id | El anime relacionado |
| relation_type | text | NOT NULL | sequel, prequel, alternative, spin_off, side_story, adaptation |

## Validación con Zod

Todos los endpoints de creación/actualización validan el body con Zod schemas. Los schemas se definen en `src/validators/` y se usan con el middleware `zValidator` de Hono.

Ejemplos de schemas:

```typescript
// validators/anime.ts
export const createAnimeSchema = z.object({
  title: z.string().min(1),
  alt_titles: z.record(z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().url().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).default('not_yet_aired'),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),  // Nombres de géneros, ej: ["Action", "Fantasy"]
  rating: z.number().min(0).max(10).optional(),
});

export const updateAnimeSchema = z.object({
  title: z.string().min(1).optional(),
  alt_titles: z.record(z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().url().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).optional(),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),  // Reemplaza todos los géneros
  rating: z.number().min(0).max(10).optional(),
});
```

```typescript
// validators/seasons.ts
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
```

```typescript
// validators/episodes.ts
export const createEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().optional(),
  duration: z.number().int().positive().optional(),
  air_date: z.string().optional(),
  season_id: z.number().int().optional(),
});
```

## Endpoints

### Base URL: `/api`

---

### Anime

#### `GET /api/anime`

Listar anime con filtros y paginación.

**Query params:**

| Param | Type | Description |
|---|---|---|
| page | integer | Página (default: 1) |
| limit | integer | Por página (default: 20, max: 100) |
| search | string | Búsqueda en título y alt_titles |
| media_type | string | Filtrar por tipo: tv, movie, ova, ona, special |
| status | string | Filtrar por estado |
| genre | string | Nombres de género, separados por coma: `genre=Action,Romance` |
| season_year | integer | Filtrar por año de temporada |
| season_name | string | Filtrar por temporada (winter, spring, summer, fall) |
| sort | string | Campo: title, rating, created_at (default: created_at) |
| order | string | asc o desc (default: desc) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "One Punch Man",
      "alt_titles": {"japanese": "ワンパンマン", "english": "One Punch Man"},
      "media_type": "tv",
      "status": "finished",
      "rating": 8.72,
      "image_url": "...",
      "genres": ["Action", "Comedy"],
      "season_count": 2,
      "created_at": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### `GET /api/anime/:id`

Detalle de un anime con géneros, temporadas y relaciones.

**Response:**
```json
{
  "data": {
    "id": 1,
    "title": "One Punch Man",
    "alt_titles": {"japanese": "ワンパンマン", "english": "One Punch Man"},
    "synopsis": "...",
    "image_url": "...",
    "media_type": "tv",
    "status": "finished",
    "source": "manga",
    "rating": 8.72,
    "duration": null,
    "release_date": null,
    "genres": [
      {"id": 1, "name": "Action"},
      {"id": 5, "name": "Comedy"}
    ],
    "seasons": [
      {
        "id": 1,
        "season_number": 1,
        "title": "One Punch Man Season 1",
        "episode_count": 12,
        "season_year": 2015,
        "season_name": "fall",
        "external_rating": 8.72,
        "start_date": "2015-10-05",
        "end_date": "2015-12-21"
      }
    ],
    "relations": [
      {"id": 3, "title": "One Punch Man Season 2", "relation_type": "sequel"}
    ],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

#### `POST /api/anime`

Crear anime. Body validado con `createAnimeSchema`.

#### `PUT /api/anime/:id`

Actualizar anime. Body validado con `updateAnimeSchema` (partial).

#### `DELETE /api/anime/:id`

Eliminar anime y sus dependencias (seasons, episodes, anime_genres, anime_relations).

---

### Seasons

#### `GET /api/anime/:animeId/seasons`

Listar temporadas de un anime.

#### `GET /api/anime/:animeId/seasons/:seasonId`

Detalle de una temporada, incluye lista de episodios.

#### `POST /api/anime/:animeId/seasons`

Crear temporada. Body validado con `createSeasonSchema`. Valida que `anime_id` existe y que `season_number` no se duplica.

#### `PUT /api/anime/:animeId/seasons/:seasonId`

Actualizar temporada.

#### `DELETE /api/anime/:animeId/seasons/:seasonId`

Eliminar temporada y sus episodios.

---

#### `GET /api/seasons`

Listar temporadas globales (para explorar por temporada).

**Query params:**

| Param | Type | Description |
|---|---|---|
| year | integer | Filtrar por año |
| name | string | Filtrar por nombre (winter, spring, summer, fall) |

**Response:**
```json
{
  "data": [
    {
      "year": 2025,
      "season": "spring",
      "anime_count": 15
    }
  ]
}
```

---

### Episodes

#### `GET /api/anime/:animeId/seasons/:seasonId/episodes`

Listar episodios de una temporada.

#### `GET /api/anime/:animeId/episodes`

Listar episodios de un anime sin temporada (OVAs, specials).

#### `GET /api/anime/:animeId/episodes/:episodeId`

Detalle de un episodio sin temporada.

#### `POST /api/anime/:animeId/episodes`

Crear episodio sin temporada. Si se incluye `season_id`, debe pertenecer al `:animeId` del path. Si no se incluye, el episodio se crea sin temporada.

#### `PUT /api/anime/:animeId/episodes/:episodeId`

Actualizar episodio sin temporada.

#### `DELETE /api/anime/:animeId/episodes/:episodeId`

Eliminar episodio sin temporada.

#### `PUT /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId`

Actualizar episodio.

#### `DELETE /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId`

Eliminar episodio.

---

### Genres

#### `GET /api/genres`

Listar todos los géneros con conteo de anime.

**Response:**
```json
{
  "data": [
    {"id": 1, "name": "Action", "anime_count": 42},
    {"id": 5, "name": "Comedy", "anime_count": 28}
  ]
}
```

#### `POST /api/genres`

Crear género. Body: `{ "name": "Mecha" }`.

#### `PUT /api/genres/:id`

Actualizar género. Body: `{ "name": "..." }`.

#### `DELETE /api/genres/:id`

Eliminar género (remueve asociaciones en anime_genres).

---

### Anime Relations

#### `POST /api/anime/:id/relations`

Crear relación. Body:
```json
{
  "target_anime_id": 3,
  "relation_type": "sequel"
}
```

#### `DELETE /api/anime/:id/relations/:relationId`

Eliminar relación.

---

### Health

#### `GET /api/health`

```json
{ "status": "ok" }
```

---

### API Documentation

#### `GET /api/docs`

Devuelve un markdown generado automáticamente que documenta todos los endpoints, parámetros, tipos de request/response y códigos de estado. Diseñado para ser consumido por agentes de IA — liviano en contexto, fácil de escanear.

El markdown se genera a partir de las rutas y Zod schemas definidos en el código, asegurando que siempre esté en sync con la implementación.

---

## Response Format

### Success (listas)
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 150, "total_pages": 8 }
}
```

### Success (individual)
```json
{ "data": { ... } }
```

### Error
```json
{ "error": { "code": 404, "message": "Anime not found" } }
```

### Status Codes
- 200 — OK
- 201 — Created (POST responses return the created resource)
- 204 — No Content (DELETE responses, no body)
- 400 — Validation error
- 404 — Not Found
- 500 — Server Error

---

## Testing Strategy

- **Runner:** `bun test`
- **DB:** SQLite `:memory:` — fresca por test suite, creada con migraciones Drizzle
- **Testing style:** Integration — se instancia la app Hono y se usa `app.request()` directamente, sin levantar servidor HTTP
- **Estructura:** Un test suite por recurso en `test/`
- **Helpers:** Módulo `test/helpers.ts` con:
  - `createTestApp()` — instancia Hono con DB in-memory y rutas configuradas
  - `seedAnime()` — inserta datos de prueba
  - `seedSeasons()`, `seedEpisodes()`, etc.

### Tests por recurso

**anime.test.ts**
- Listar anime (con paginación, filtros, búsqueda)
- Obtener anime por ID (con géneros, temporadas, relaciones)
- Crear anime (validación Zod, media_type válido)
- Actualizar anime (partial update)
- Eliminar anime (cascade a seasons, episodes, genres, relations)
- 404 para anime inexistente

**seasons.test.ts**
- Listar temporadas de un anime
- Obtener temporada con episodios
- Crear temporada (validar anime existe, season_number único)
- Actualizar temporada
- Eliminar temporada (cascade a episodes)

**episodes.test.ts**
- Listar episodios de una temporada
- Listar episodios sin temporada (OVAs)
- Crear episodio (en temporada y sin temporada)
- Validar unique constraint de episode_number
- Actualizar episodio
- Eliminar episodio

**genres.test.ts**
- Listar géneros con anime_count
- Crear género (nombre único)
- Actualizar género
- Eliminar género (limpia anime_genres)

**relations.test.ts**
- Crear relación (validar ambos anime existen, relation_type válido)
- Eliminar relación

---

## CORS

La API debe habilitar CORS para permitir consumo desde browsers. Se usa `hono/cors` middleware configurado en el entry point con origen `*` y métodos GET, POST, PUT, DELETE.

---

## Design Decisions

### Géneros por nombre, no por ID

Al crear o actualizar un anime, los géneros se pasan como nombres:

```json
{
  "title": "One Punch Man",
  "genres": ["Action", "Comedy"]
}
```

El servicio busca los géneros por nombre en la DB. Si un género no existe, se crea automáticamente. Al actualizar, el array de géneros reemplaza completamente los géneros anteriores.

### Recursos creados por separado

No hay creación anidada. Cada recurso se crea con su propio endpoint:
- Crear anime: `POST /api/anime`
- Crear temporada: `POST /api/anime/:animeId/seasons`
- Crear episodio: `POST /api/anime/:animeId/seasons/:seasonId/episodes`
- Asociar género: se hace al crear/actualizar el anime (campo `genres`)

### Cascading deletes

- Eliminar anime → elimina seasons, episodes, anime_genres, anime_relations
- Eliminar season → elimina episodes
- Eliminar género → elimina anime_genres asociados
- Drizzle schema debe tener `onDelete: 'cascade'` en las FK relations y `PRAGMA foreign_keys = ON` al iniciar la DB

---

## V2 Considerations (not in scope)

- **Auth** — JWT con registro/login para proteger operaciones de escritura
- **User ratings** — Tabla `user_ratings`, calculando promedio dinámicamente
- **Rate limiting** — Rate limiting por IP en endpoints públicos
- **Full-text search** — FTS5 de SQLite para búsqueda más rápida en títulos
- **Image upload** — En vez de URLs externas