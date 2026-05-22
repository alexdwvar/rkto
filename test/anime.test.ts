import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Anime API', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('GET /api/anime returns empty list', async () => {
    const res = await app.request('/api/anime');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  test('POST /api/anime creates anime successfully', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Naruto', media_type: 'tv' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.title).toBe('Naruto');
    expect(json.data.media_type).toBe('tv');
    expect(json.data.id).toBeDefined();
  });

  test('POST /api/anime validates with Zod - missing title', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'tv' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/anime validates with Zod - invalid media_type', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', media_type: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/anime creates with genres', async () => {
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'One Punch Man', media_type: 'tv', genres: ['Action', 'Comedy'] }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.genres).toEqual(['Action', 'Comedy']);
  });

  test('GET /api/anime/:id returns anime with genres and seasons', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', media_type: 'tv', genres: ['Action'] }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe(id);
    expect(json.data.genres).toBeDefined();
    expect(json.data.seasons).toBeDefined();
  });

  test('GET /api/anime/:id returns 404 for non-existent', async () => {
    const res = await app.request('/api/anime/9999');
    expect(res.status).toBe(404);
  });

  test('GET /api/anime with filters', async () => {
    await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Airing Anime', media_type: 'tv', status: 'airing' }),
    });
    await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Finished Anime', media_type: 'movie', status: 'finished' }),
    });

    const res = await app.request('/api/anime?status=airing');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].status).toBe('airing');
  });

  test('PUT /api/anime/:id updates anime', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Test', status: 'finished' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe('Updated Test');
    expect(json.data.status).toBe('finished');
  });

  test('PUT /api/anime/:id updates genres (replace all)', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', media_type: 'tv', genres: ['Action'] }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genres: ['Romance', 'Drama'] }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.genres).toEqual(['Romance', 'Drama']);
  });

  test('DELETE /api/anime/:id deletes anime', async () => {
    const createRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', media_type: 'tv' }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    const res = await app.request(`/api/anime/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);

    const getRes = await app.request(`/api/anime/${id}`);
    expect(getRes.status).toBe(404);
  });

  test('PUT /api/anime/:id returns 404 for non-existent', async () => {
    const res = await app.request('/api/anime/9999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/anime/:id returns 404 for non-existent', async () => {
    const res = await app.request('/api/anime/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});