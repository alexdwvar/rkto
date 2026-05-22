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

  if (err instanceof Error) {
    if (err.message.includes('UNIQUE constraint')) {
      return c.json({ error: { code: 409, message: 'Unique constraint violation' } }, 409);
    }
    if (err.message.includes('FOREIGN KEY')) {
      return c.json({ error: { code: 400, message: 'Referenced resource not found' } }, 400);
    }
    if (err.message.includes('not found') || err.message.includes('Not found')) {
      return c.json({ error: { code: 404, message: err.message } }, 404);
    }
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { code: 500, message: 'Internal server error' } }, 500);
};