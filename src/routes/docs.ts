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