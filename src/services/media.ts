import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { media } from '../db/schema';

export function shouldTranscode(mimeType: string, originalName: string): boolean {
  if (mimeType === 'video/mp4') return false;
  if (mimeType === 'video/webm') return false;
  if (mimeType === 'text/vtt') return false;
  if (mimeType === 'application/x-subrip') return false;
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  return !['mp4', 'webm'].includes(ext);
}

const TRANSCODABLE_EXTS = new Set(['mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ogm', 'webm']);

export function canTranscode(ext: string): boolean {
  return TRANSCODABLE_EXTS.has(ext.toLowerCase());
}

export async function resetMediaForRetry(db: Database, id: number): Promise<boolean> {
  const result = await db.update(media)
    .set({ status: 'processing', progressStep: 'pending', progress: 0 })
    .where(eq(media.id, id))
    .returning()
    .get();
  return !!result;
}

function getR2Config() {
  const accountId = Bun.env.R2_ACCOUNT_ID;
  const accessKeyId = Bun.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = Bun.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env');
  }
  return { accountId, accessKeyId, secretAccessKey };
}

function getBucketName(): string {
  return Bun.env.R2_BUCKET_NAME || 'rkto-media';
}

let clientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (clientInstance) return clientInstance;
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  clientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return clientInstance;
}

function generateKey(animeId: number, episodeId: number | null, lang: string, filename: string): string {
  const id = crypto.randomUUID();
  const ext = filename.includes('.') ? filename.split('.').pop() || 'mp4' : 'mp4';
  const episodePart = episodeId ? `e${episodeId}` : 'no-ep';
  return `v/${animeId}/${episodePart}/${lang}/${id}.${ext}`;
}

export async function createPresignedUploadUrl(params: {
  animeId: number;
  episodeId: number | null;
  lang: string;
  sourceName: string;
  filename: string;
  mimeType: string;
  audio?: string[];
  subs?: string[];
  expiresIn?: number;
}): Promise<{ url: string; key: string }> {
  const client = getS3Client();
  const key = generateKey(params.animeId, params.episodeId, params.lang, params.filename);

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: params.mimeType,
  });

  const url = await getSignedUrl(client, command, { expiresIn: params.expiresIn || 3600 });
  return { url, key };
}

export async function createPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  }));
}

export async function saveMediaReference(db: Database, data: {
  episodeId: number | null;
  animeId: number;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes?: number;
  audio?: string[];
  subs?: string[];
  sourceName: string;
  lang: string;
}) {
  const needsProcessing = shouldTranscode(data.mimeType, data.originalName);
  const result = await db.insert(media).values({
    episodeId: data.episodeId,
    animeId: data.animeId,
    key: data.key,
    originalName: data.originalName,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    audio: data.audio ? JSON.stringify(data.audio) : null,
    subs: data.subs ? JSON.stringify(data.subs) : null,
    sourceName: data.sourceName,
    lang: data.lang,
    status: needsProcessing ? 'pending' : 'ready',
    progress: needsProcessing ? 0 : 100,
    progressStep: needsProcessing ? 'pending' : 'done',
  }).returning().get();

  return { ...mapMediaRow(result), needsTranscode: needsProcessing };
}

export async function listMediaByEpisode(db: Database, episodeId: number) {
  const results = await db.select().from(media).where(eq(media.episodeId, episodeId));
  return results.map(mapMediaRow);
}

export async function listMediaByAnime(db: Database, animeId: number) {
  const results = await db.select().from(media).where(eq(media.animeId, animeId));
  return results.map(mapMediaRow);
}

export async function getMediaById(db: Database, id: number) {
  const result = await db.select().from(media).where(eq(media.id, id)).get();
  return result ? mapMediaRow(result) : null;
}

export async function deleteMedia(db: Database, id: number) {
  const existing = await db.select().from(media).where(eq(media.id, id)).get();
  if (!existing) return false;
  await db.delete(media).where(eq(media.id, id));
  const keysToDelete = [existing.key];
  if (existing.transcodedKey) keysToDelete.push(existing.transcodedKey);
  for (const key of keysToDelete) {
    try {
      await deleteFromR2(key);
    } catch {
      // R2 deletion is best-effort
    }
  }
  return true;
}

export async function deleteMediaFiles(db: Database, animeId: number) {
  const allMedia = await db.select().from(media).where(eq(media.animeId, animeId));
  for (const m of allMedia) {
    const keysToDelete = [m.key];
    if (m.transcodedKey) keysToDelete.push(m.transcodedKey);
    for (const key of keysToDelete) {
      try {
        await deleteFromR2(key);
      } catch {
        // R2 deletion is best-effort
      }
    }
  }
}

function mapMediaRow(row: typeof media.$inferSelect) {
  return {
    id: row.id,
    episode_id: row.episodeId,
    anime_id: row.animeId,
    key: row.transcodedKey ?? row.key,
    original_key: row.key,
    original_name: row.originalName,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    audio: row.audio ? JSON.parse(row.audio) : null,
    subs: row.subs ? JSON.parse(row.subs) : null,
    subtitle_keys: row.subtitleKeys ? JSON.parse(row.subtitleKeys) : null,
    source_name: row.sourceName,
    lang: row.lang,
    status: row.status,
    progress: row.progress,
    progress_step: row.progressStep,
    uploaded_at: row.uploadedAt,
  };
}