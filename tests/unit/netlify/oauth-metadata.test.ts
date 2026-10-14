import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import asMetadata from '@/../netlify/functions/oauth-as-metadata';
import resourceMetadata from '@/../netlify/functions/oauth-resource-metadata';

const call = (h: typeof asMetadata, method = 'GET') =>
  h(new Request('http://localhost/.well-known/x', { method }), {} as any);

describe('OAuth discovery documents', () => {
  beforeEach(() => {
    process.env['APP_URL'] = 'https://app.example';
  });
  afterEach(() => {
    delete process.env['APP_URL'];
  });

  it('serves RFC 8414 authorization server metadata', async () => {
    const res = await call(asMetadata);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({
      issuer: 'https://app.example',
      authorization_endpoint: 'https://app.example/oauth/authorize',
      token_endpoint: 'https://app.example/oauth/token',
      registration_endpoint: 'https://app.example/oauth/register',
      revocation_endpoint: 'https://app.example/oauth/revoke',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['lists'],
    });
  });

  it('serves RFC 9728 protected resource metadata for /mcp', async () => {
    const res = await call(resourceMetadata);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      resource: 'https://app.example/mcp',
      authorization_servers: ['https://app.example'],
      scopes_supported: ['lists'],
      bearer_methods_supported: ['header'],
      resource_name: 'Buy The Way',
    });
  });

  it('answers CORS preflight and refuses other methods', async () => {
    expect((await call(asMetadata, 'OPTIONS')).status).toBe(204);
    expect((await call(resourceMetadata, 'OPTIONS')).status).toBe(204);
    expect((await call(asMetadata, 'POST')).status).toBe(405);
    expect((await call(resourceMetadata, 'DELETE')).status).toBe(405);
  });
});
