import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createTestDb } from '../src/db/connection';
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
  const { anime } = await import('../src/db/schema');
  const result = await db.insert(anime).values({
    title: 'Test Anime',
    mediaType: 'tv',
    ...overrides,
  } as any).returning().get();
  return result;
}

export async function seedGenre(db: ReturnType<typeof createTestDb>, name: string = 'Action') {
  const { genres } = await import('../src/db/schema');
  const result = await db.insert(genres).values({ name }).returning().get();
  return result;
}

export async function seedSeason(db: ReturnType<typeof createTestDb>, animeId: number, overrides: Record<string, unknown> = {}) {
  const { seasons } = await import('../src/db/schema');
  const result = await db.insert(seasons).values({
    animeId,
    seasonNumber: 1,
    ...overrides,
  } as any).returning().get();
  return result;
}

export async function seedEpisode(db: ReturnType<typeof createTestDb>, animeId: number, seasonId: number | null, overrides: Record<string, unknown> = {}) {
  const { episodes } = await import('../src/db/schema');
  const result = await db.insert(episodes).values({
    animeId,
    seasonId,
    episodeNumber: 1,
    ...overrides,
  } as any).returning().get();
  return result;
}