import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const anime = sqliteTable('anime', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  altTitles: text('alt_titles'), // JSON string
  synopsis: text('synopsis'),
  imageUrl: text('image_url'),
  mediaType: text('media_type').notNull(),
  status: text('status').notNull().default('not_yet_aired'),
  source: text('source'),
  duration: integer('duration'),
  releaseDate: text('release_date'),
  rating: real('rating'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  title: text('title'),
  seasonNumber: integer('season_number').notNull(),
  episodeCount: integer('episode_count'),
  seasonYear: integer('season_year'),
  seasonName: text('season_name'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  externalRating: real('external_rating'),
}, (table) => [
  uniqueIndex('seasons_anime_id_season_number_unique').on(table.animeId, table.seasonNumber),
]);

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  seasonId: integer('season_id').references(() => seasons.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  duration: integer('duration'),
  airDate: text('air_date'),
}, (table) => [
  uniqueIndex('episodes_season_id_episode_number_unique').on(table.seasonId, table.episodeNumber),
]);

export const genres = sqliteTable('genres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const animeGenres = sqliteTable('anime_genres', {
  animeId: integer('anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.animeId, table.genreId] }),
]);

export const animeRelationsTable = sqliteTable('anime_relations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceAnimeId: integer('source_anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  targetAnimeId: integer('target_anime_id').notNull().references(() => anime.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
});

export const animeRelations = relations(anime, ({ many }) => ({
  seasons: many(seasons),
  genres: many(animeGenres),
  sourceRelations: many(animeRelationsTable, { relationName: 'source' }),
  targetRelations: many(animeRelationsTable, { relationName: 'target' }),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  anime: one(anime, { fields: [seasons.animeId], references: [anime.id] }),
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  anime: one(anime, { fields: [episodes.animeId], references: [anime.id] }),
  season: one(seasons, { fields: [episodes.seasonId], references: [seasons.id] }),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  animes: many(animeGenres),
}));

export const animeGenresRelations = relations(animeGenres, ({ one }) => ({
  anime: one(anime, { fields: [animeGenres.animeId], references: [anime.id] }),
  genre: one(genres, { fields: [animeGenres.genreId], references: [genres.id] }),
}));

export const animeRelationsTableRelations = relations(animeRelationsTable, ({ one }) => ({
  sourceAnime: one(anime, { fields: [animeRelationsTable.sourceAnimeId], references: [anime.id], relationName: 'source' }),
  targetAnime: one(anime, { fields: [animeRelationsTable.targetAnimeId], references: [anime.id], relationName: 'target' }),
}));