import { z } from 'zod';

export const createRelationSchema = z.object({
  target_anime_id: z.number().int().positive(),
  relation_type: z.enum(['sequel', 'prequel', 'alternative', 'spin_off', 'side_story', 'adaptation']),
});