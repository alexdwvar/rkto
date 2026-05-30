const TMDB_BASE = 'https://api.themoviedb.org/3';
const DEFAULT_LANGUAGE = 'es-ES';

function getApiKey(): string {
  const key = Bun.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set in environment');
  return key;
}

function getAccessToken(): string | undefined {
  return Bun.env.TMDB_ACCESS_TOKEN;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('language', params.language ?? DEFAULT_LANGUAGE);
  for (const [k, v] of Object.entries(params)) {
    if (k === 'language') continue;
    url.searchParams.set(k, v);
  }
  const accessToken = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    url.searchParams.set('api_key', getApiKey());
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB API error: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface TMDBSearchResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  popularity: number;
}

export interface TMDBSearchParams {
  query: string;
  page?: number;
  language?: string;
}

export async function searchTV(params: TMDBSearchParams) {
  const p: Record<string, string> = { query: params.query };
  if (params.page) p.page = String(params.page);
  if (params.language) p.language = params.language;
  return tmdbFetch<{
    page: number;
    results: TMDBSearchResult[];
    total_pages: number;
    total_results: number;
  }>('/search/tv', p);
}

export interface TMDBSeason {
  air_date: string | null;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

export interface TMDBTVDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string | null;
  last_air_date: string | null;
  status: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  in_production: boolean;
  origin_country: string[];
  original_language: string;
  homepage: string | null;
  seasons: TMDBSeason[];
  type: string;
}

export async function getTVDetail(tmdbId: number, language?: string) {
  const p: Record<string, string> = {};
  if (language) p.language = language;
  return tmdbFetch<TMDBTVDetail>(`/tv/${tmdbId}`, p);
}

export interface TMDBEpisode {
  air_date: string | null;
  episode_number: number;
  name: string;
  overview: string;
  season_number: number;
  still_path: string | null;
  vote_average: number;
  runtime: number | null;
}

export interface TMDBSeasonDetail {
  id: number;
  name: string;
  overview: string;
  air_date: string | null;
  season_number: number;
  episodes: TMDBEpisode[];
  poster_path: string | null;
}

export async function getSeasonDetail(tmdbId: number, seasonNumber: number, language?: string) {
  const p: Record<string, string> = {};
  if (language) p.language = language;
  return tmdbFetch<TMDBSeasonDetail>(`/tv/${tmdbId}/season/${seasonNumber}`, p);
}

export interface TMDBGenre {
  id: number;
  name: string;
}

let genreCache: Map<number, string> | null = null;

export async function getTVGenreMap(): Promise<Map<number, string>> {
  if (genreCache) return genreCache;
  const result = await tmdbFetch<{ genres: TMDBGenre[] }>('/genre/tv/list', { language: 'en-US' });
  genreCache = new Map(result.genres.map((g) => [g.id, g.name]));
  return genreCache;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function posterUrl(path: string | null, size: string = 'w500'): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: string = 'original'): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

const TMDB_STATUS_MAP: Record<string, string> = {
  'Returning Series': 'airing',
  'Ended': 'finished',
  'Canceled': 'cancelled',
  'Cancelled': 'cancelled',
  'Pilot': 'not_yet_aired',
  'In Production': 'not_yet_aired',
  'Planned': 'not_yet_aired',
};

export function mapTMDBStatus(status: string): string {
  return TMDB_STATUS_MAP[status] ?? 'not_yet_aired';
}

export function inferMediaType(detail: TMDBTVDetail): string {
  if (detail.episode_run_time.length === 1 && detail.episode_run_time[0] === 1) return 'movie';
  const typeStr = (detail.type || '').toLowerCase();
  if (typeStr.includes('documentary')) return 'special';
  return 'tv';
}