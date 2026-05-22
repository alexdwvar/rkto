import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createGenreSchema, updateGenreSchema } from '../validators/genres';
import type { Database } from '../db/connection';
import * as genreService from '../services/genres';

export const genresRoutes = new Hono<{ Variables: { db: Database } }>();

genresRoutes.get('/genres', async (c) => {
  const db = c.get('db');
  const genres = await genreService.listGenres(db);
  return c.json({ data: genres });
});

genresRoutes.post('/genres', zValidator('json', createGenreSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');
  const genre = await genreService.createGenre(db, body.name);
  return c.json({ data: genre }, 201);
});

genresRoutes.put('/genres/:id', zValidator('json', updateGenreSchema), async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const genre = await genreService.updateGenre(db, id, body.name);
  if (!genre) return c.json({ error: { code: 404, message: 'Genre not found' } }, 404);
  return c.json({ data: genre });
});

genresRoutes.delete('/genres/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const deleted = await genreService.deleteGenre(db, id);
  if (!deleted) return c.json({ error: { code: 404, message: 'Genre not found' } }, 404);
  return c.body(null, 204);
});