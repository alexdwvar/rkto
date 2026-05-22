import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createEpisodeSchema, updateEpisodeSchema } from '../validators/episodes';
import type { Database } from '../db/connection';
import * as episodeService from '../services/episodes';

export const episodesRoutes = new Hono<{ Variables: { db: Database } }>();

episodesRoutes.get('/anime/:animeId/seasons/:seasonId/episodes', async (c) => {
  const db = c.get('db');
  const seasonId = Number(c.req.param('seasonId'));
  const episodes = await episodeService.listEpisodesBySeason(db, seasonId);
  return c.json({ data: episodes });
});

episodesRoutes.get('/anime/:animeId/seasons/:seasonId/episodes/:episodeId', async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const episode = await episodeService.getEpisodeById(db, episodeId);
  if (!episode) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.json({ data: episode });
});

episodesRoutes.post('/anime/:animeId/seasons/:seasonId/episodes', zValidator('json', createEpisodeSchema), async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const seasonId = Number(c.req.param('seasonId'));
  const body = c.req.valid('json');
  const episode = await episodeService.createEpisode(db, animeId, { ...body, season_id: seasonId });
  if (!episode) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: episode }, 201);
});

episodesRoutes.put('/anime/:animeId/seasons/:seasonId/episodes/:episodeId', zValidator('json', updateEpisodeSchema), async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const body = c.req.valid('json');
  const episode = await episodeService.updateEpisode(db, episodeId, body);
  if (!episode) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.json({ data: episode });
});

episodesRoutes.delete('/anime/:animeId/seasons/:seasonId/episodes/:episodeId', async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const deleted = await episodeService.deleteEpisode(db, episodeId);
  if (!deleted) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.body(null, 204);
});

episodesRoutes.get('/anime/:animeId/episodes', async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const episodes = await episodeService.listEpisodesByAnime(db, animeId);
  return c.json({ data: episodes });
});

episodesRoutes.get('/anime/:animeId/episodes/:episodeId', async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const episode = await episodeService.getEpisodeById(db, episodeId);
  if (!episode) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.json({ data: episode });
});

episodesRoutes.post('/anime/:animeId/episodes', zValidator('json', createEpisodeSchema), async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  const body = c.req.valid('json');
  const episode = await episodeService.createEpisode(db, animeId, body);
  if (!episode) return c.json({ error: { code: 404, message: 'Anime not found' } }, 404);
  return c.json({ data: episode }, 201);
});

episodesRoutes.put('/anime/:animeId/episodes/:episodeId', zValidator('json', updateEpisodeSchema), async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const body = c.req.valid('json');
  const episode = await episodeService.updateEpisode(db, episodeId, body);
  if (!episode) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.json({ data: episode });
});

episodesRoutes.delete('/anime/:animeId/episodes/:episodeId', async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  const deleted = await episodeService.deleteEpisode(db, episodeId);
  if (!deleted) return c.json({ error: { code: 404, message: 'Episode not found' } }, 404);
  return c.body(null, 204);
});