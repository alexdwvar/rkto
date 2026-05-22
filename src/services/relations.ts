import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { animeRelationsTable } from '../db/schema';

export async function createRelation(db: Database, sourceAnimeId: number, targetAnimeId: number, relationType: string) {
  const result = await db.insert(animeRelationsTable).values({
    sourceAnimeId,
    targetAnimeId,
    relationType,
  }).returning().get();
  return result;
}

export async function deleteRelation(db: Database, sourceAnimeId: number, relationId: number) {
  const existing = await db.select().from(animeRelationsTable).where(
    and(eq(animeRelationsTable.id, relationId), eq(animeRelationsTable.sourceAnimeId, sourceAnimeId))
  ).get();
  if (!existing) return false;
  await db.delete(animeRelationsTable).where(eq(animeRelationsTable.id, relationId));
  return true;
}