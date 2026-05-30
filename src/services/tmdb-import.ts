import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { anime } from '../db/schema';
import * as animeService from './anime';
import * as seasonService from './seasons';
import * as tmdb from './tmdb';
import { createEpisode } from './episodes';
import type { TMDBTVDetail } from './tmdb';

interface ImportOptions {
  includeSeasons?: boolean;
  includeEpisodes?: boolean;
  language?: string;
  overrides?: Partial<{
    media_type: string;
    source: string;
    status: string;
    title: string;
  }>;
}

export async function importFromTMDB(
  db: Database,
  tmdbId: number,
  options: ImportOptions = {}
): Promise<ReturnType<typeof animeService.getAnimeById>> {
  const { includeSeasons = true, includeEpisodes = false, language, overrides = {} } = options;

  const detail = await tmdb.getTVDetail(tmdbId, language);

  const existing = await db.select({ id: anime.id }).from(anime).where(eq(anime.title, detail.name)).get();
  if (existing) {
    throw new Error(`Anime "${detail.name}" already exists with id ${existing.id}`);
  }

  const genreMap = await tmdb.getTVGenreMap();
  const genreNames = detail.genres.map((g) => genreMap.get(g.id) ?? g.name);

  const altTitles: Record<string, string> = {};
  if (detail.original_name && detail.original_name !== detail.name) {
    altTitles[detail.original_language] = detail.original_name;
  }

  const animeData = {
    title: overrides.title ?? detail.name,
    synopsis: detail.overview || undefined,
    image_url: tmdb.posterUrl(detail.poster_path) ?? undefined,
    cover_url: tmdb.backdropUrl(detail.backdrop_path) ?? undefined,
    media_type: overrides.media_type ?? tmdb.inferMediaType(detail) ?? 'tv',
    status: overrides.status ?? tmdb.mapTMDBStatus(detail.status),
    source: overrides.source,
    source_url: detail.homepage || undefined,
    duration: detail.episode_run_time[0] || undefined,
    release_date: detail.first_air_date || undefined,
    rating: detail.vote_average || undefined,
    genres: genreNames.length > 0 ? genreNames : undefined,
    alt_titles: Object.keys(altTitles).length > 0 ? altTitles : undefined,
  };

  const created = await animeService.createAnime(db, animeData);
  if (!created) throw new Error('Failed to create anime');

  if (includeSeasons && detail.seasons.length > 0) {
    const validSeasons = detail.seasons.filter((s) => s.season_number > 0);

    for (const season of validSeasons) {
      const seasonYear = season.air_date ? new Date(season.air_date).getFullYear() : undefined;
      await seasonService.createSeason(db, created.id, {
        title: season.name || `Season ${season.season_number}`,
        season_number: season.season_number,
        episode_count: season.episode_count,
        season_year: seasonYear,
        start_date: season.air_date ?? undefined,
        external_rating: season.vote_average || undefined,
      });

      if (includeEpisodes && season.episode_count > 0) {
        try {
          const seasonDetail = await tmdb.getSeasonDetail(tmdbId, season.season_number, language);
          const dbSeasons = await seasonService.listSeasonsByAnime(db, created.id);
          const dbSeason = dbSeasons?.find((s) => s.season_number === season.season_number);
          if (!dbSeason) continue;
          for (const ep of seasonDetail.episodes) {
            await createEpisode(db, created.id, {
              season_id: dbSeason.id,
              episode_number: ep.episode_number,
              title: ep.name || `Episode ${ep.episode_number}`,
              duration: ep.runtime ?? undefined,
              air_date: ep.air_date ?? undefined,
            });
          }
        } catch {
          // skip episodes if TMDB fetch fails
        }
      }
    }
  }

  return animeService.getAnimeById(db, created.id);
}