import { describe, test, expect } from 'vitest';
import { handleRequest } from '../src/index';

describe('Email Marketing Worker', () => {
  test('returns 404 for unknown routes', async () => {
    const request = new Request('https://example.com/unknown', {
      method: 'GET'
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(404);
  });

  test('handles unsubscribe GET request', async () => {
    const request = new Request('https://example.com/unsubscribe?email=test@example.com', {
      method: 'GET'
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  test('handles tracking pixel request', async () => {
    const request = new Request('https://example.com/track/open?campaign=test&email=user@example.com', {
      method: 'GET'
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
  });
});
