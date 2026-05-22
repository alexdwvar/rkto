import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { genres, animeGenres } from '../db/schema';

function mapGenreRow(row: { id: number; name: string }) {
  return {
    id: row.id,
    name: row.name,
  };
}

export async function listGenres(db: Database) {
  const results = await db
    .select({
      id: genres.id,
      name: genres.name,
      animeCount: sql<number>`count(${animeGenres.animeId})`.as('anime_count'),
    })
    .from(genres)
    .leftJoin(animeGenres, eq(genres.id, animeGenres.genreId))
    .groupBy(genres.id, genres.name);
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    anime_count: row.animeCount,
  }));
}

export async function getGenreById(db: Database, id: number) {
  const result = await db.select().from(genres).where(eq(genres.id, id)).get();
  return result ? mapGenreRow(result) : null;
}

export async function createGenre(db: Database, name: string) {
  const result = await db.insert(genres).values({ name }).returning().get();
  return mapGenreRow(result);
}

export async function updateGenre(db: Database, id: number, name: string) {
  const result = await db.update(genres).set({ name }).where(eq(genres.id, id)).returning().get();
  return result ? mapGenreRow(result) : null;
}

export async function deleteGenre(db: Database, id: number) {
  const existing = await db.select().from(genres).where(eq(genres.id, id)).get();
  if (!existing) return false;
  await db.delete(genres).where(eq(genres.id, id));
  return true;
}

export async function resolveGenreNames(db: Database, names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const existing = await db.select().from(genres).where(inArray(genres.name, names));
  const existingMap = new Map(existing.map((g) => [g.name, g.id]));

  const missing = names.filter((n) => !existingMap.has(n));
  for (const name of missing) {
    const created = await db.insert(genres).values({ name }).returning().get();
    existingMap.set(name, created.id);
  }

  return names.map((n) => existingMap.get(n)!);
}