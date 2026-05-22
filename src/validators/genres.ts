import { z } from 'zod';

export const createGenreSchema = z.object({
  name: z.string().min(1),
});

export const updateGenreSchema = z.object({
  name: z.string().min(1),
});