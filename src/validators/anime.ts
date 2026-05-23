import { z } from 'zod';

export const createAnimeSchema = z.object({
  title: z.string().min(1),
  alt_titles: z.record(z.string(), z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).default('not_yet_aired'),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
});

export const updateAnimeSchema = z.object({
  title: z.string().min(1).optional(),
  alt_titles: z.record(z.string(), z.string()).optional(),
  synopsis: z.string().optional(),
  image_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).optional(),
  source: z.enum(['manga', 'light_novel', 'original', 'game', 'other']).optional(),
  duration: z.number().int().positive().optional(),
  release_date: z.string().optional(),
  genres: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
});

export const animeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  media_type: z.enum(['tv', 'movie', 'ova', 'ona', 'special']).optional(),
  status: z.enum(['airing', 'finished', 'not_yet_aired', 'paused', 'cancelled']).optional(),
  genre: z.string().optional(),
  season_year: z.coerce.number().int().optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
  sort: z.enum(['title', 'rating', 'created_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});