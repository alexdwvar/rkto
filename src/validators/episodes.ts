import { z } from 'zod';

export const createEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().optional(),
  duration: z.number().int().positive().optional(),
  air_date: z.string().optional(),
});

export const updateEpisodeSchema = createEpisodeSchema.partial();