import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 400,
          message: 'Validation error',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  if (err instanceof Error && err.message.includes('not found')) {
    return c.json({ error: { code: 404, message: err.message } }, 404);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { code: 500, message: 'Internal server error' } }, 500);
};