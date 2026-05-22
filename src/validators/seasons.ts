import { z } from 'zod';

export const createSeasonSchema = z.object({
  title: z.string().optional(),
  season_number: z.number().int().min(1),
  episode_count: z.number().int().positive().optional(),
  season_year: z.number().int().min(1900).max(2100).optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  external_rating: z.number().min(0).max(10).optional(),
});

export const updateSeasonSchema = createSeasonSchema.partial();

export const seasonListQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  season_name: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
});