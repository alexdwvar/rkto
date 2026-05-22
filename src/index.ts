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