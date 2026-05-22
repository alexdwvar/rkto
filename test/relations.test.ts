import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Relations API', () => {
  let app: any;
  let anime1Id: number;
  let anime2Id: number;

  beforeEach(async () => {
    const result = createTestApp();
    app = result.app;
    const res1 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Attack on Titan', media_type: 'tv' }),
    });
    anime1Id = (await res1.json()).data.id;

    const res2 = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Attack on Titan S2', media_type: 'tv' }),
    });
    anime2Id = (await res2.json()).data.id;
  });

  test('POST /api/anime/:id/relations creates relation', async () => {
    const res = await app.request(`/api/anime/${anime1Id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: anime2Id, relation_type: 'sequel' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.relation_type).toBe('sequel');
    expect(json.data.source_anime_id).toBe(anime1Id);
    expect(json.data.target_anime_id).toBe(anime2Id);
  });

  test('POST /api/anime/:id/relations validates relation_type enum', async () => {
    const res = await app.request(`/api/anime/${anime1Id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: anime2Id, relation_type: 'invalid_type' }),
    });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/anime/:id/relations/:relationId deletes relation', async () => {
    const createRes = await app.request(`/api/anime/${anime1Id}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_anime_id: anime2Id, relation_type: 'sequel' }),
    });
    const relationId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${anime1Id}/relations/${relationId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('DELETE /api/anime/:id/relations/:relationId returns 404 for non-existent', async () => {
    const res = await app.request(`/api/anime/${anime1Id}/relations/9999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});