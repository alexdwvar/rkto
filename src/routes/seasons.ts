import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createSeasonSchema, updateSeasonSchema, seasonListQuerySchema } from '../validators/seasons';
import type { Database } from '../db/connection';
import * as seasonService from '../services/seasons';

export const seasonsRoutes = new Hono<{ Variables: { db: Database } }>();

seasonsRoutes.get('/anime/:animeId/seasons', async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const seasons = await seasonService.listSeasonsByAnime(db, animeId);
  return c.json({ data: seasons });
});

seasonsRoutes.get('/anime/:animeId/seasons/:seasonId', async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const seasonId = Number(c.req.param('seasonId'));
  const season = await seasonService.getSeasonById(db, animeId, seasonId);
  if (!season) return c.json({ error: { code: 404, message: 'Season not found' } }, 404);
  return c.json({ data: season });
});

seasonsRoutes.post('/anime/:animeId/seasons', zValidator('json', createSeasonSchema), async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const body = c.req.valid('json');
  const season = await seasonService.createSeason(db, animeId, body);
  if (!season) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: season }, 201);
});

seasonsRoutes.put('/anime/:animeId/seasons/:seasonId', zValidator('json', updateSeasonSchema), async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const seasonId = Number(c.req.param('seasonId'));
  const body = c.req.valid('json');
  const season = await seasonService.updateSeason(db, animeId, seasonId, body);
  if (!season) return c.json({ error: { code: 404, message: 'Season not found' } }, 404);
  return c.json({ data: season });
});

seasonsRoutes.delete('/anime/:animeId/seasons/:seasonId', async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const seasonId = Number(c.req.param('seasonId'));
  const deleted = await seasonService.deleteSeason(db, animeId, seasonId);
  if (!deleted) return c.json({ error: { code: 404, message: 'Season not found' } }, 404);
  return c.body(null, 204);
});

seasonsRoutes.get('/seasons', async (c) => {
  const db = c.get('db');
  const query = seasonListQuerySchema.parse(c.req.query());
  const seasons = await seasonService.listGlobalSeasons(db, { year: query.year, season_name: query.season_name });
  return c.json({ data: seasons });
});