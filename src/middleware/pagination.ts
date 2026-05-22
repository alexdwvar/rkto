import type { Context, Next } from 'hono';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export async function paginationMiddleware(c: Context, next: Next) {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;

  c.set('pagination', { page, limit, offset } satisfies PaginationParams);
  await next();
}

export function paginateResponse(data: unknown[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}