import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Episodes API', () => {
  let app: any;
  let animeId: number;
  let seasonId: number;

  beforeEach(async () => {
    const result = createTestApp();
    app = result.app;
    const animeRes = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Anime', media_type: 'tv' }),
    });
    animeId = (await animeRes.json()).data.id;

    const seasonRes = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    seasonId = (await seasonRes.json()).data.id;
  });

  test('GET /api/anime/:animeId/seasons/:seasonId/episodes returns empty list', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  test('POST /api/anime/:animeId/seasons/:seasonId/episodes creates episode in season', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1, title: 'Pilot' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.episode_number).toBe(1);
    expect(json.data.season_id).toBe(seasonId);
  });

  test('GET /api/anime/:animeId/episodes lists episodes without season (OVAs)', async () => {
    await app.request(`/api/anime/${animeId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1, title: 'OVA 1' }),
    });

    const res = await app.request(`/api/anime/${animeId}/episodes`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].season_id).toBeNull();
  });

  test('POST /api/anime/:animeId/episodes creates episode without season', async () => {
    const res = await app.request(`/api/anime/${animeId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1, title: 'OVA Special' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.season_id).toBeNull();
  });

  test('Unique constraint: duplicate episode_number in same season', async () => {
    await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1 }),
    });
    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1 }),
    });
    expect(res.status).toBe(409);
  });

  test('Unique constraint: duplicate episode_number for same anime without season', async () => {
    await app.request(`/api/anime/${animeId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1 }),
    });
    const res = await app.request(`/api/anime/${animeId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1 }),
    });
    expect(res.status).toBe(409);
  });

  test('PUT /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId updates episode', async () => {
    const createRes = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1, title: 'Episode 1' }),
    });
    const episodeId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes/${episodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe('Updated Title');
  });

  test('DELETE /api/anime/:animeId/seasons/:seasonId/episodes/:episodeId deletes episode', async () => {
    const createRes = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_number: 1 }),
    });
    const episodeId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes/${episodeId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('404 for non-existent episode', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}/episodes/9999`);
    expect(res.status).toBe(404);
  });
});