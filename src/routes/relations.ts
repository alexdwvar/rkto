import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createRelationSchema } from '../validators/relations';
import type { Database } from '../db/connection';
import * as relationService from '../services/relations';

export const relationsRoutes = new Hono<{ Variables: { db: Database } }>();

relationsRoutes.post('/anime/:id/relations', zValidator('json', createRelationSchema), async (c) => {
  const db = c.get('db');
  const sourceAnimeId = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const relation = await relationService.createRelation(db, sourceAnimeId, body.target_anime_id, body.relation_type);
  if (!relation) return c.json({ error: { code: 404, message: 'Source anime not found' } }, 404);
  return c.json({ data: relation }, 201);
});

relationsRoutes.delete('/anime/:id/relations/:relationId', async (c) => {
  const db = c.get('db');
  const sourceAnimeId = Number(c.req.param('id'));
  const relationId = Number(c.req.param('relationId'));
  const deleted = await relationService.deleteRelation(db, sourceAnimeId, relationId);
  if (!deleted) return c.json({ error: { code: 404, message: 'Relation not found' } }, 404);
  return c.body(null, 204);
});