import { z } from 'zod';

const videoSourceSchema = z.object({
  source: z.string().min(1),
  url: z.string().min(1),
});

export const createEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().optional(),
  duration: z.number().int().positive().optional(),
  air_date: z.string().optional(),
  video_url: z.array(videoSourceSchema).optional(),
});

export const updateEpisodeSchema = createEpisodeSchema.partial();