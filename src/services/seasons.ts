import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { seasons, episodes } from '../db/schema';

export async function listSeasonsByAnime(db: Database, animeId: number) {
  const results = await db.select().from(seasons).where(eq(seasons.animeId, animeId));
  return results.map(mapSeasonRow);
}

export async function getSeasonById(db: Database, animeId: number, seasonId: number) {
  const season = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!season) return null;
  const episodeList = await db.select().from(episodes).where(eq(episodes.seasonId, seasonId));
  return { ...mapSeasonRow(season), episodes: episodeList.map(mapEpisodeRow) };
}

export async function createSeason(db: Database, animeId: number, data: {
  title?: string;
  season_number: number;
  episode_count?: number;
  season_year?: number;
  season_name?: string;
  start_date?: string;
  end_date?: string;
  external_rating?: number;
}) {
  const result = await db.insert(seasons).values({
    animeId,
    title: data.title,
    seasonNumber: data.season_number,
    episodeCount: data.episode_count,
    seasonYear: data.season_year,
    seasonName: data.season_name,
    startDate: data.start_date,
    endDate: data.end_date,
    externalRating: data.external_rating,
  }).returning().get();
  return mapSeasonRow(result);
}

export async function updateSeason(db: Database, animeId: number, seasonId: number, data: Record<string, unknown>) {
  const existing = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.season_number !== undefined) updateData.seasonNumber = data.season_number;
  if (data.episode_count !== undefined) updateData.episodeCount = data.episode_count;
  if (data.season_year !== undefined) updateData.seasonYear = data.season_year;
  if (data.season_name !== undefined) updateData.seasonName = data.season_name;
  if (data.start_date !== undefined) updateData.startDate = data.start_date;
  if (data.end_date !== undefined) updateData.endDate = data.end_date;
  if (data.external_rating !== undefined) updateData.externalRating = data.external_rating;

  await db.update(seasons).set(updateData).where(eq(seasons.id, seasonId));
  return getSeasonById(db, animeId, seasonId);
}

export async function deleteSeason(db: Database, animeId: number, seasonId: number) {
  const existing = await db.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.animeId, animeId))).get();
  if (!existing) return false;
  await db.delete(seasons).where(eq(seasons.id, seasonId));
  return true;
}

export async function listGlobalSeasons(db: Database, filters: { year?: number; season_name?: string }) {
  const conditions = [];
  if (filters.year) conditions.push(eq(seasons.seasonYear, filters.year));
  if (filters.season_name) conditions.push(eq(seasons.seasonName, filters.season_name));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      year: seasons.seasonYear,
      season: seasons.seasonName,
      anime_count: sql<number>`count(distinct ${seasons.animeId})`,
    })
    .from(seasons)
    .where(where)
    .groupBy(seasons.seasonYear, seasons.seasonName)
    .orderBy(seasons.seasonYear, seasons.seasonNumber);
}

function mapSeasonRow(row: typeof seasons.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    title: row.title,
    season_number: row.seasonNumber,
    episode_count: row.episodeCount,
    season_year: row.seasonYear,
    season_name: row.seasonName,
    start_date: row.startDate,
    end_date: row.endDate,
    external_rating: row.externalRating,
  };
}

function mapEpisodeRow(row: typeof episodes.$inferSelect) {
  return {
    id: row.id,
    anime_id: row.animeId,
    season_id: row.seasonId,
    episode_number: row.episodeNumber,
    title: row.title,
    duration: row.duration,
    air_date: row.airDate,
  };
}