import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createAnimeSchema, updateAnimeSchema, animeListQuerySchema } from '../validators/anime';
import type { Database } from '../db/connection';
import * as animeService from '../services/anime';

export const animeRoutes = new Hono<{ Variables: { db: Database } }>();

animeRoutes.get('/anime', async (c) => {
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

animeRoutes.get('/anime/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const result = await animeService.getAnimeById(db, id);
  if (!result) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: result });
});

animeRoutes.post('/anime', zValidator('json', createAnimeSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');
  const result = await animeService.createAnime(db, body);
  return c.json({ data: result }, 201);
});

animeRoutes.put('/anime/:id', zValidator('json', updateAnimeSchema), async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await animeService.updateAnime(db, id, body);
  if (!result) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: result });
});

animeRoutes.delete('/anime/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const deleted = await animeService.deleteAnime(db, id);
  if (!deleted) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.body(null, 204);
});