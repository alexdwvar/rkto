import { Hono } from 'hono';
import type { Database } from '../db/connection';
import * as tmdb from '../services/tmdb';
import { importFromTMDB } from '../services/tmdb-import';

export const tmdbRoutes = new Hono<{ Variables: { db: Database } }>();

tmdbRoutes.get('/tmdb/search', async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ error: { code: 400, message: 'query parameter is required' } }, 400);
  const page = c.req.query('page') ? Math.max(1, Number(c.req.query('page')) || 1) : 1;
  const language = c.req.query('language');
  try {
    const result = await tmdb.searchTV({ query, page, language });
    return c.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TMDB API error';
    return c.json({ error: { code: 502, message } }, 502);
  }
});

tmdbRoutes.get('/tmdb/tv/:id', async (c) => {
  const tmdbId = Number(c.req.param('id'));
  if (isNaN(tmdbId)) return c.json({ error: { code: 400, message: 'Invalid TMDB ID' } }, 400);
  const language = c.req.query('language');
  try {
    const detail = await tmdb.getTVDetail(tmdbId, language);
    return c.json({ data: detail });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TMDB API error';
    return c.json({ error: { code: 502, message } }, 502);
  }
});

tmdbRoutes.post('/tmdb/import/:id', async (c) => {
  const db = c.get('db');
  const tmdbId = Number(c.req.param('id'));
  if (isNaN(tmdbId)) return c.json({ error: { code: 400, message: 'Invalid TMDB ID' } }, 400);

  const includeSeasons = c.req.query('include_seasons') !== 'false';
  const includeEpisodes = c.req.query('include_episodes') === 'true';
  const language = c.req.query('language');
  const overrides = await c.req.json().catch(() => ({}));

  try {
    const result = await importFromTMDB(db, tmdbId, { includeSeasons, includeEpisodes, language, overrides });
    return c.json({ data: result }, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already exists')) {
      return c.json({ error: { code: 409, message: err.message } }, 409);
    }
    const message = err instanceof Error ? err.message : 'Import failed';
    return c.json({ error: { code: 502, message } }, 502);
  }
});