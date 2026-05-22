import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDb(filename: string = 'anime.db') {
  const sqlite = new Database(filename);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  pushSchema(sqlite);
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL');
  return db;
}

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  pushSchema(sqlite);
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS episodes_anime_id_episode_number_null_season ON episodes(anime_id, episode_number) WHERE season_id IS NULL');
  return db;
}

function pushSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      alt_titles TEXT,
      synopsis TEXT,
      image_url TEXT,
      media_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_yet_aired',
      source TEXT,
      duration INTEGER,
      release_date TEXT,
      rating REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      title TEXT,
      season_number INTEGER NOT NULL,
      episode_count INTEGER,
      season_year INTEGER,
      season_name TEXT,
      start_date TEXT,
      end_date TEXT,
      external_rating REAL,
      UNIQUE(anime_id, season_number)
    );
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title TEXT,
      duration INTEGER,
      air_date TEXT,
      UNIQUE(season_id, episode_number)
    );
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS anime_genres (
      anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
      PRIMARY KEY (anime_id, genre_id)
    );
    CREATE TABLE IF NOT EXISTS anime_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      target_anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL
    );
  `);
}

export type Database = ReturnType<typeof createDb>;