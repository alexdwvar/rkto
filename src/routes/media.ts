import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { media } from '../db/schema';
import * as mediaService from '../services/media';
import { startTranscode } from '../services/transcode';
import { presignedUploadSchema, confirmUploadSchema } from '../validators/media';

export const mediaRoutes = new Hono<{ Variables: { db: Database } }>();

mediaRoutes.get('/media/subtitle/:key{.+}', async (c) => {
  const db = c.get('db');
  const key = c.req.param('key');

  const allMedia = await db.select().from(media).all();
  let foundKey: string | null = null;

  for (const m of allMedia) {
    if (m.subtitleKeys) {
      try {
        const parsed = JSON.parse(m.subtitleKeys) as { lang: string; key: string }[];
        if (parsed.some(s => s.key === key)) {
          foundKey = key;
          break;
        }
      } catch {}
    }
  }

  if (!foundKey) {
    return c.json({ error: { code: 404, message: 'Subtitle not found' } }, 404);
  }

  const url = await mediaService.createPresignedDownloadUrl(key, 3600);
  return c.json({ data: { url } });
});

mediaRoutes.post('/media/upload-url', zValidator('json', presignedUploadSchema), async (c) => {
  const body = c.req.valid('json');

  const { url, key } = await mediaService.createPresignedUploadUrl({
    animeId: body.anime_id,
    episodeId: body.episode_id ?? null,
    lang: body.lang,
    sourceName: body.source_name,
    filename: body.filename,
    mimeType: body.mime_type,
    audio: body.audio,
    subs: body.subs,
  });

  return c.json({ data: { upload_url: url, key } });
});

mediaRoutes.post('/media/confirm', zValidator('json', confirmUploadSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  const result = await mediaService.saveMediaReference(db, {
    episodeId: body.episode_id ?? null,
    animeId: body.anime_id,
    key: body.key,
    originalName: body.original_name,
    mimeType: body.mime_type,
    sizeBytes: body.size_bytes,
    sourceName: body.source_name,
    lang: body.lang,
    audio: body.audio,
    subs: body.subs,
  });

  if (result.needsTranscode) {
    const mediaId = result.id;
    startTranscode(db, mediaId).catch((err) => {
      console.error(`Transcode failed for media ${mediaId}:`, err);
    });
  }

  return c.json({ data: result }, 201);
});

mediaRoutes.get('/media/episode/:episodeId', async (c) => {
  const db = c.get('db');
  const episodeId = Number(c.req.param('episodeId'));
  if (isNaN(episodeId)) return c.json({ error: { code: 400, message: 'Invalid episode ID' } }, 400);
  const mediaList = await mediaService.listMediaByEpisode(db, episodeId);

  const signedMedia = await Promise.all(mediaList.map(async (m) => ({
    ...m,
    url: m.status === 'ready' ? await mediaService.createPresignedDownloadUrl(m.key) : null,
  })));

  return c.json({ data: signedMedia });
});

mediaRoutes.get('/media/anime/:animeId', async (c) => {
  const db = c.get('db');
  const animeId = Number(c.req.param('animeId'));
  if (isNaN(animeId)) return c.json({ error: { code: 400, message: 'Invalid anime ID' } }, 400);
  const mediaList = await mediaService.listMediaByAnime(db, animeId);

  const signedMedia = await Promise.all(mediaList.map(async (m) => ({
    ...m,
    url: m.status === 'ready' ? await mediaService.createPresignedDownloadUrl(m.key) : null,
  })));

  return c.json({ data: signedMedia });
});

mediaRoutes.get('/media/:id/status', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 400, message: 'Invalid media ID' } }, 400);
  const mediaItem = await mediaService.getMediaById(db, id);
  if (!mediaItem) return c.json({ error: { code: 404, message: 'Media not found' } }, 404);

  return c.json({
    data: {
      id: mediaItem.id,
      status: mediaItem.status,
      progress: mediaItem.progress,
      progress_step: mediaItem.progress_step,
    },
  });
});

mediaRoutes.get('/media/:id/play', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 400, message: 'Invalid media ID' } }, 400);
  const mediaItem = await mediaService.getMediaById(db, id);
  if (!mediaItem) return c.json({ error: { code: 404, message: 'Media not found' } }, 404);
  if (mediaItem.status !== 'ready') return c.json({ error: { code: 425, message: 'Media is still processing' } }, 425);

  const url = await mediaService.createPresignedDownloadUrl(mediaItem.key);
  return c.redirect(url);
});

mediaRoutes.delete('/media/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 400, message: 'Invalid media ID' } }, 400);
  const deleted = await mediaService.deleteMedia(db, id);
  if (!deleted) return c.json({ error: { code: 404, message: 'Media not found' } }, 404);
  return c.body(null, 204);
});

mediaRoutes.post('/media/:id/retry', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: { code: 400, message: 'Invalid media ID' } }, 400);
  const mediaItem = await mediaService.getMediaById(db, id);
  if (!mediaItem) return c.json({ error: { code: 404, message: 'Media not found' } }, 404);
  if (mediaItem.status !== 'error') return c.json({ error: { code: 400, message: 'Can only retry failed transcodes' } }, 400);

  await mediaService.resetMediaForRetry(db, id);

  startTranscode(db, id).catch((err) => {
    console.error(`Transcode retry failed for media ${id}:`, err);
  });

  return c.json({ data: { id, status: 'processing' } });
});