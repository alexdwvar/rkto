import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { anime, animeRelationsTable } from '../db/schema';

function mapRelationRow(row: typeof animeRelationsTable.$inferSelect) {
  return {
    id: row.id,
    source_anime_id: row.sourceAnimeId,
    target_anime_id: row.targetAnimeId,
    relation_type: row.relationType,
  };
}

export async function createRelation(db: Database, sourceAnimeId: number, targetAnimeId: number, relationType: string) {
  const source = await db.select({ id: anime.id }).from(anime).where(eq(anime.id, sourceAnimeId)).get();
  if (!source) return null;
  const target = await db.select({ id: anime.id }).from(anime).where(eq(anime.id, targetAnimeId)).get();
  if (!target) throw new Error('Target anime not found');

  const result = await db.insert(animeRelationsTable).values({
    sourceAnimeId,
    targetAnimeId,
    relationType,
  }).returning().get();
  return mapRelationRow(result);
}

export async function deleteRelation(db: Database, sourceAnimeId: number, relationId: number) {
  const existing = await db.select().from(animeRelationsTable).where(
    and(eq(animeRelationsTable.id, relationId), eq(animeRelationsTable.sourceAnimeId, sourceAnimeId))
  ).get();
  if (!existing) return false;
  await db.delete(animeRelationsTable).where(eq(animeRelationsTable.id, relationId));
  return true;
}