import { describe, test, expect, beforeEach } from 'bun:test';
import { createTestApp } from './helpers';

describe('Genres API', () => {
  let app: any;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
  });

  test('GET /api/genres returns empty list', async () => {
    const res = await app.request('/api/genres');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  test('POST /api/genres creates genre', async () => {
    const res = await app.request('/api/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Action' }),
    });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.name).toBe('Action');
  });

  test('GET /api/genres returns genres with anime_count', async () => {
    await app.request('/api/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Action' }),
    });

    const res = await app.request('/api/genres');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.data[0].name).toBe('Action');
    expect(json.data[0].anime_count).toBe(0);
  });

  test('PUT /api/genres/:id updates genre', async () => {
    const createRes = await app.request('/api/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Action' }),
    });
    const id = (await createRes.json()).data.id;

    const res = await app.request(`/api/genres/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Action Updated' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Action Updated');
  });

  test('DELETE /api/genres/:id deletes genre', async () => {
    const createRes = await app.request('/api/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Action' }),
    });
    const id = (await createRes.json()).data.id;

    const res = await app.request(`/api/genres/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  test('DELETE /api/genres/:id returns 404 for non-existent', async () => {
    const res = await app.request('/api/genres/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});