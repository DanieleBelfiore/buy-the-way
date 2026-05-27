import { describe, it, expect } from 'vitest';
import { jsonResponse } from '@/../netlify/functions/_lib/http';

describe('jsonResponse', () => {
  it('returns JSON with the given status', async () => {
    const res = jsonResponse(418, { error: 'teapot' });
    expect(res.status).toBe(418);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ error: 'teapot' });
  });
});
