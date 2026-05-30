import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Anime slug tests', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('slug is auto-generated from title on create', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'One Punch Man', media_type: 'tv' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.slug).toBe('one-punch-man');
  });

  test('slug handles special characters and accents', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Shingeki no Kyojin: Final Season', media_type: 'tv' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.slug).toBe('shingeki-no-kyojin-final-season');
  });

  test('slug handles accented characters', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Démon Slayer', media_type: 'tv' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.slug).toBe('demon-slayer');
  });

  test('slug falls back to untitled for empty title after normalization', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '!!!', media_type: 'tv' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.slug).toBe('untitled');
  });

  test('slug deduplicates on collision', async () => {
    await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Naruto', media_type: 'tv' }),
    });
    const res2 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Naruto', media_type: 'tv' }),
    });
    const json2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(json2.data.slug).toBe('naruto-1');

    const res3 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Naruto', media_type: 'tv' }),
    });
    const json3 = await res3.json();
    expect(res3.status).toBe(201);
    expect(json3.data.slug).toBe('naruto-2');
  });

  test('custom slug on create', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Anime', media_type: 'tv', slug: 'custom-slug' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.slug).toBe('custom-slug');
  });

  test('slug updates when title changes and no explicit slug', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Old Title', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', media_type: 'tv', status: 'airing', genres: ['Action'] }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.slug).toBe('new-title');
  });

  test('explicit slug on update overrides auto-generation', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Anime', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Anime', media_type: 'tv', status: 'airing', genres: ['Action'], slug: 'my-custom-slug' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.slug).toBe('my-custom-slug');
  });

  test('empty slug on update is rejected', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Original Title', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Original Title', media_type: 'tv', status: 'airing', genres: ['Action'], slug: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/anime/:slug returns anime by slug', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Slug Anime', media_type: 'tv' }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/anime/test-slug-anime`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe(created.data.id);
    expect(json.data.slug).toBe('test-slug-anime');
  });

  test('GET /api/anime/:id still works with numeric id', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ID Test', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`);
    expect(res.status).toBe(200);
  });
});

describe('Self-relation prevention', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('POST /api/anime/:id/relations rejects self-relation', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Self Anime', media_type: 'tv' }),
    });
    const id = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: id, relation_type: 'sequel' }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('itself');
  });

  test('POST /api/anime/:id/relations rejects duplicate relation', async () => {
    const res1 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anime A', media_type: 'tv' }),
    });
    const res2 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anime B', media_type: 'tv' }),
    });
    const id1 = (await res1.json()).data.id;
    const id2 = (await res2.json()).data.id;

    await app.request(`/api/anime/${id1}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: id2, relation_type: 'sequel' }),
    });

    const dupRes = await app.request(`/api/anime/${id1}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: id2, relation_type: 'sequel' }),
    });
    expect(dupRes.status).toBe(409);
  });
});

describe('Episode IDOR prevention', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('GET /api/anime/:animeId/seasons/:seasonId/episodes rejects season belonging to other anime', async () => {
    const anime1Res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anime 1', media_type: 'tv' }),
    });
    const anime1Id = (await anime1Res.json()).data.id;

    const anime2Res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Anime 2', media_type: 'tv' }),
    });
    const anime2Id = (await anime2Res.json()).data.id;

    const seasonRes = await app.request(`/api/anime/${anime1Id}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    const seasonId = (await seasonRes.json()).data.id;

    const res = await app.request(`/api/anime/${anime2Id}/seasons/${seasonId}/episodes`);
    expect(res.status).toBe(403);
  });

  test('GET /api/anime/:animeId/seasons returns 404 for non-existent anime', async () => {
    const res = await app.request('/api/anime/9999/seasons');
    expect(res.status).toBe(404);
  });

  test('GET /api/anime/:animeId/episodes returns 404 for non-existent anime', async () => {
    const res = await app.request('/api/anime/9999/episodes');
    expect(res.status).toBe(404);
  });
});

describe('Genre filter does not auto-create', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('GET /api/anime?genre=NonExistent returns empty but does not create genre', async () => {
    const res = await app.request('/api/anime?genre=NonExistent');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.pagination.total).toBe(0);

    const genresRes = await app.request('/api/genres');
    const genresJson = await genresRes.json();
    const nonExistent = genresJson.data.find((g: any) => g.name === 'NonExistent');
    expect(nonExistent).toBeUndefined();
  });
});