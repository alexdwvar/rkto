import { eq, and, isNull } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { anime, seasons, episodes } from '../db/schema';

function mapEpisodeRow(row: typeof episodes.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    season_id: row.seasonId,
    episode_number: row.episodeNumber,
    title: row.title,
    duration: row.duration,
    air_date: row.airDate,
    video_url: row.videoUrl ? JSON.parse(row.videoUrl) : null,
  };
}

export async function listEpisodesBySeason(db: Database, seasonId: number) {
  const results = await db.select().from(episodes).where(eq(episodes.seasonId, seasonId));
  return results.map(mapEpisodeRow);
}

export async function listEpisodesByAnime(db: Database, animeId: number) {
  const results = await db.select().from(episodes).where(and(eq(episodes.animeId, animeId), isNull(episodes.seasonId)));
  return results.map(mapEpisodeRow);
}

export async function getEpisodeById(db: Database, episodeId: number) {
  const result = await db.select().from(episodes).where(eq(episodes.id, episodeId)).get();
  return result ? mapEpisodeRow(result) : null;
}

export async function createEpisode(db: Database, animeId: number, data: {
  episode_number: number;
  title?: string;
  duration?: number;
  air_date?: string;
  season_id?: number;
  video_url?: string;
}) {
  const existingAnime = await db.select({ id: anime.id }).from(anime).where(eq(anime.id, animeId)).get();
  if (!existingAnime) return null;

  if (data.season_id) {
    const season = await db.select({ id: seasons.id, animeId: seasons.animeId })
      .from(seasons).where(eq(seasons.id, data.season_id)).get();
    if (!season) throw new Error('Season not found');
    if (season.animeId !== animeId) throw new Error('Season does not belong to this anime');
  }

  const result = await db.insert(episodes).values({
    animeId,
    seasonId: data.season_id ?? null,
    episodeNumber: data.episode_number,
    title: data.title,
    duration: data.duration,
    airDate: data.air_date,
    videoUrl: data.video_url ? JSON.stringify(data.video_url) : null,
  }).returning().get();
  return mapEpisodeRow(result);
}

export async function updateEpisode(db: Database, episodeId: number, data: Record<string, unknown>) {
  const existing = await db.select().from(episodes).where(eq(episodes.id, episodeId)).get();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.episode_number !== undefined) updateData.episodeNumber = data.episode_number;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.air_date !== undefined) updateData.airDate = data.air_date;
  if (data.season_id !== undefined) updateData.seasonId = data.season_id;
  if (data.video_url !== undefined) updateData.videoUrl = JSON.stringify(data.video_url);

  await db.update(episodes).set(updateData).where(eq(episodes.id, episodeId));
  return getEpisodeById(db, episodeId);
}

export async function deleteEpisode(db: Database, episodeId: number) {
  const existing = await db.select().from(episodes).where(eq(episodes.id, episodeId)).get();
  if (!existing) return false;
  await db.delete(episodes).where(eq(episodes.id, episodeId));
  return true;
}