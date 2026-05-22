import { createDb } from './connection';
import { anime, seasons, episodes, genres, animeGenres } from './schema';

async function seed() {
  const db = createDb();
  const sqlite = db.$client as import('bun:sqlite').Database;

  sqlite.exec('DELETE FROM episodes');
  sqlite.exec('DELETE FROM anime_genres');
  sqlite.exec('DELETE FROM anime_relation');
  sqlite.exec('DELETE FROM anime_relations');
  sqlite.exec('DELETE FROM seasons');
  sqlite.exec('DELETE FROM anime');
  sqlite.exec('DELETE FROM genres');

  const [action, comedy, drama, fantasy, mecha, romance] = await db.insert(genres).values([
    { name: 'Action' },
    { name: 'Comedy' },
    { name: 'Drama' },
    { name: 'Fantasy' },
    { name: 'Mecha' },
    { name: 'Romance' },
  ]).returning();

  const [opm, aot, eva, mononoke, ghibli] = await db.insert(anime).values([
    {
      title: 'One Punch Man',
      altTitles: JSON.stringify({ japanese: 'ワンパンマン', english: 'One Punch Man' }),
      synopsis: 'Saitama is a hero who can defeat any opponent with a single punch.',
      mediaType: 'tv',
      status: 'finished',
      source: 'manga',
      rating: 8.5,
    },
    {
      title: 'Attack on Titan',
      altTitles: JSON.stringify({ japanese: '進撃の巨人', english: 'Attack on Titan' }),
      synopsis: 'Humanity lives behind walls to protect themselves from Titans.',
      mediaType: 'tv',
      status: 'finished',
      source: 'manga',
      rating: 9.0,
    },
    {
      title: 'Neon Genesis Evangelion',
      altTitles: JSON.stringify({ japanese: '新世紀エヴァンゲリオン' }),
      synopsis: 'Teenagers pilot giant mechs to fight mysterious Angels.',
      mediaType: 'tv',
      status: 'finished',
      source: 'original',
      rating: 8.3,
    },
    {
      title: 'Princess Mononoke',
      altTitles: JSON.stringify({ japanese: 'もののけ姫' }),
      synopsis: 'A prince is cursed and must find a cure in the forest.',
      mediaType: 'movie',
      status: 'finished',
      source: 'original',
      rating: 8.4,
      duration: 134,
      releaseDate: '1997-07-12',
    },
    {
      title: 'Your Name',
      altTitles: JSON.stringify({ japanese: '君の名は。', english: 'Your Name' }),
      synopsis: 'Two teenagers discover they are swapping bodies.',
      mediaType: 'movie',
      status: 'finished',
      source: 'original',
      rating: 8.9,
      duration: 106,
      releaseDate: '2016-08-26',
    },
  ]).returning();

  await db.insert(animeGenres).values([
    { animeId: opm.id, genreId: action.id },
    { animeId: opm.id, genreId: comedy.id },
    { animeId: aot.id, genreId: action.id },
    { animeId: aot.id, genreId: drama.id },
    { animeId: aot.id, genreId: fantasy.id },
    { animeId: eva.id, genreId: mecha.id },
    { animeId: eva.id, genreId: drama.id },
    { animeId: eva.id, genreId: action.id },
    { animeId: mononoke.id, genreId: fantasy.id },
    { animeId: mononoke.id, genreId: action.id },
  ]);

  const [opmS1, opmS2, aotS1, aotS2] = await db.insert(seasons).values([
    {
      animeId: opm.id,
      title: 'One Punch Man Season 1',
      seasonNumber: 1,
      episodeCount: 12,
      seasonYear: 2015,
      seasonName: 'fall',
      startDate: '2015-10-05',
      endDate: '2015-12-21',
      externalRating: 8.72,
    },
    {
      animeId: opm.id,
      title: 'One Punch Man Season 2',
      seasonNumber: 2,
      episodeCount: 12,
      seasonYear: 2019,
      seasonName: 'spring',
      startDate: '2019-04-09',
      endDate: '2019-07-02',
      externalRating: 7.14,
    },
    {
      animeId: aot.id,
      title: 'Attack on Titan Season 1',
      seasonNumber: 1,
      episodeCount: 25,
      seasonYear: 2013,
      seasonName: 'spring',
      startDate: '2013-04-07',
      endDate: '2013-09-29',
      externalRating: 8.54,
    },
    {
      animeId: aot.id,
      title: 'Attack on Titan Season 2',
      seasonNumber: 2,
      episodeCount: 12,
      seasonYear: 2017,
      seasonName: 'spring',
      startDate: '2017-04-01',
      endDate: '2017-06-17',
      externalRating: 8.61,
    },
  ]).returning();

  await db.insert(episodes).values([
    { animeId: opm.id, seasonId: opmS1.id, episodeNumber: 1, title: 'The Strongest Man', duration: 24, airDate: '2015-10-05' },
    { animeId: opm.id, seasonId: opmS1.id, episodeNumber: 2, title: 'The Lone Cyborg', duration: 24, airDate: '2015-10-11' },
    { animeId: opm.id, seasonId: opmS2.id, episodeNumber: 1, title: 'Starting Over', duration: 24, airDate: '2019-04-09' },
    { animeId: aot.id, seasonId: aotS1.id, episodeNumber: 1, title: 'To You, 2000 Years in the Future', duration: 24, airDate: '2013-04-07' },
    { animeId: aot.id, seasonId: aotS1.id, episodeNumber: 2, title: 'That Day', duration: 24, airDate: '2013-04-14' },
  ]);

  console.log('Seed data inserted successfully!');
}

seed().catch(console.error);