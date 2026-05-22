import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Seasons API', () => {
  let app: any;
  let animeId: number;

  beforeEach(async () => {
    const result = createTestApp();
    app = result.app;
    const res = await app.request('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Anime', media_type: 'tv' }),
    });
    const json = await res.json();
    animeId = json.data.id;
  });

  test('GET /api/anime/:animeId/seasons returns empty list', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  test('POST /api/anime/:animeId/seasons creates season', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1, season_year: 2024, season_name: 'spring' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.season_number).toBe(1);
    expect(json.data.anime_id).toBe(animeId);
  });

  test('POST /api/anime/:animeId/seasons validates unique season_number', async () => {
    await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    const res = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    expect(res.status).toBe(409);
  });

  test('GET /api/anime/:animeId/seasons/:seasonId returns season with episodes', async () => {
    const createRes = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    const seasonId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe(seasonId);
    expect(json.data.episodes).toEqual([]);
  });

  test('PUT /api/anime/:animeId/seasons/:seasonId updates season', async () => {
    const createRes = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    const seasonId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Season 1 Updated' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.title).toBe('Season 1 Updated');
  });

  test('DELETE /api/anime/:animeId/seasons/:seasonId deletes season', async () => {
    const createRes = await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1 }),
    });
    const seasonId = (await createRes.json()).data.id;

    const res = await app.request(`/api/anime/${animeId}/seasons/${seasonId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('GET /api/seasons returns global seasons list', async () => {
    await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1, season_year: 2024, season_name: 'spring' }),
    });

    const res = await app.request('/api/seasons');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].year).toBe(2024);
  });

  test('GET /api/seasons?year=2024&season_name=spring filters seasons', async () => {
    await app.request(`/api/anime/${animeId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_number: 1, season_year: 2024, season_name: 'spring' }),
    });

    const res = await app.request('/api/seasons?year=2024&season_name=spring');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('GET /api/anime/:animeId/seasons/:seasonId returns 404 for non-existent', async () => {
    const res = await app.request(`/api/anime/${animeId}/seasons/9999`);
    expect(res.status).toBe(404);
  });
});