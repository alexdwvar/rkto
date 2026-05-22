import { eq, sql, like, and, or, desc, asc, inArray } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { anime, seasons, animeGenres, animeRelationsTable, genres } from '../db/schema';
import { resolveGenreNames } from './genres';
import { updateAnimeSchema } from '../validators/anime';
import type { z } from 'zod';

export async function listAnime(
  db: Database,
  options: {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    media_type?: string;
    status?: string;
    genre?: string;
    season_year?: number;
    season_name?: string;
    sort?: string;
    order?: string;
  }
) {
  const conditions = [];

  if (options.search) {
    conditions.push(or(like(anime.title, `%${options.search}%`), like(anime.altTitles, `%${options.search}%`)));
  }
  if (options.media_type) {
    conditions.push(eq(anime.mediaType, options.media_type));
  }
  if (options.status) {
    conditions.push(eq(anime.status, options.status));
  }
  if (options.season_year) {
    conditions.push(sql`EXISTS (SELECT 1 FROM seasons WHERE seasons.anime_id = anime.id AND seasons.season_year = ${options.season_year})`);
  }
  if (options.season_name) {
    conditions.push(sql`EXISTS (SELECT 1 FROM seasons WHERE seasons.anime_id = anime.id AND seasons.season_name = ${options.season_name})`);
  }

  if (options.genre) {
    const genreNames = options.genre.split(',');
    const genreIds = await resolveGenreNames(db, genreNames);
    if (genreIds.length > 0) {
      const matchingAnimeIds = await db
        .select({ animeId: animeGenres.animeId })
        .from(animeGenres)
        .where(inArray(animeGenres.genreId, genreIds))
        .groupBy(animeGenres.animeId)
        .having(sql`count(distinct ${animeGenres.genreId}) = ${genreIds.length}`);
      if (matchingAnimeIds.length === 0) {
        return { data: [], pagination: { page: options.page, limit: options.limit, total: 0, total_pages: 0 } };
      }
      conditions.push(inArray(anime.id, matchingAnimeIds.map((r) => r.animeId)));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = options.sort === 'title' ? anime.title : options.sort === 'rating' ? anime.rating : anime.createdAt;
  const orderFn = options.order === 'asc' ? asc : desc;

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(anime).where(where);
  
  const results = await db
    .select()
    .from(anime)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(options.limit)
    .offset(options.offset);

  const animeWithGenres = await Promise.all(
    results.map(async (a) => {
      const genreList = await db
        .select({ name: genres.name })
        .from(animeGenres)
        .innerJoin(genres, eq(animeGenres.genreId, genres.id))
        .where(eq(animeGenres.animeId, a.id));
      const [{ count: seasonCount }] = await db.select({ count: sql<number>`count(*)` }).from(seasons).where(eq(seasons.animeId, a.id));
      return {
        ...mapAnimeRow(a),
        genres: genreList.map((g) => g.name),
        season_count: seasonCount,
      };
    })
  );

  return {
    data: animeWithGenres,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      total_pages: Math.ceil(total / options.limit),
    },
  };
}

export async function getAnimeById(db: Database, id: number) {
  const result = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!result) return null;

  const genreList = await db
    .select({ id: genres.id, name: genres.name })
    .from(animeGenres)
    .innerJoin(genres, eq(animeGenres.genreId, genres.id))
    .where(eq(animeGenres.animeId, id));

  const seasonList = await db.select().from(seasons).where(eq(seasons.animeId, id));

  const relationsList = await db
    .select({
      id: anime.id,
      title: anime.title,
      relation_type: animeRelationsTable.relationType,
    })
    .from(animeRelationsTable)
    .innerJoin(anime, eq(animeRelationsTable.targetAnimeId, anime.id))
    .where(eq(animeRelationsTable.sourceAnimeId, id));

  return {
    ...mapAnimeRow(result),
    genres: genreList,
    seasons: seasonList.map(mapSeasonRow),
    relations: relationsList,
  };
}

export async function createAnime(db: Database, data: {
  title: string;
  alt_titles?: Record<string, string>;
  synopsis?: string;
  image_url?: string;
  media_type: string;
  status?: string;
  source?: string;
  duration?: number;
  release_date?: string;
  genres?: string[];
  rating?: number;
}) {
  const altTitlesJson = data.alt_titles ? JSON.stringify(data.alt_titles) : null;

  const result = await db.insert(anime).values({
    title: data.title,
    altTitles: altTitlesJson,
    synopsis: data.synopsis,
    imageUrl: data.image_url,
    mediaType: data.media_type,
    status: data.status ?? 'not_yet_aired',
    source: data.source,
    duration: data.duration,
    releaseDate: data.release_date,
    rating: data.rating,
  }).returning().get();

  if (data.genres && data.genres.length > 0) {
    const genreIds = await resolveGenreNames(db, data.genres);
    await db.insert(animeGenres).values(genreIds.map((gid) => ({ animeId: result.id, genreId: gid })));
  }

  return getAnimeById(db, result.id);
}

export async function updateAnime(db: Database, id: number, data: z.infer<typeof updateAnimeSchema>) {
  const existing = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.alt_titles !== undefined) updateData.altTitles = JSON.stringify(data.alt_titles);
  if (data.synopsis !== undefined) updateData.synopsis = data.synopsis;
  if (data.image_url !== undefined) updateData.imageUrl = data.image_url;
  if (data.media_type !== undefined) updateData.mediaType = data.media_type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.release_date !== undefined) updateData.releaseDate = data.release_date;
  if (data.rating !== undefined) updateData.rating = data.rating;
  updateData.updatedAt = sql`(datetime('now'))`;

  await db.update(anime).set(updateData).where(eq(anime.id, id));

  if (data.genres !== undefined) {
    const genreNames = data.genres as string[];
    await db.delete(animeGenres).where(eq(animeGenres.animeId, id));
    if (genreNames.length > 0) {
      const genreIds = await resolveGenreNames(db, genreNames);
      await db.insert(animeGenres).values(genreIds.map((gid) => ({ animeId: id, genreId: gid })));
    }
  }

  return getAnimeById(db, id);
}

export async function deleteAnime(db: Database, id: number) {
  const existing = await db.select().from(anime).where(eq(anime.id, id)).get();
  if (!existing) return false;
  await db.delete(anime).where(eq(anime.id, id));
  return true;
}

function mapAnimeRow(row: typeof anime.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    alt_titles: row.altTitles ? JSON.parse(row.altTitles) : null,
    synopsis: row.synopsis,
    image_url: row.imageUrl,
    media_type: row.mediaType,
    status: row.status,
    source: row.source,
    duration: row.duration,
    release_date: row.releaseDate,
    rating: row.rating,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
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