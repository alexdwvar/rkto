import { z } from 'zod';

export const langCodeSchema = z.enum(['ja', 'en', 'es', 'es-419', 'es-ES']);