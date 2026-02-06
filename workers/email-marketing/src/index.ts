export interface Env {
  DB: D1Database;
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle unsubscribe
  if (path === '/unsubscribe') {
    const email = url.searchParams.get('email');
    if (!email) {
      return new Response('Missing email parameter', { status: 400 });
    }

    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>Unsubscribe Confirmation</title></head>
<body>
  <h1>You've been unsubscribed</h1>
  <p>Email: ${email}</p>
  <p>You will no longer receive marketing emails from us.</p>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  // Handle tracking pixel (email opens)
  if (path === '/track/open') {
    // Return 1x1 transparent GIF
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
      0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
      0x01, 0x00, 0x3b
    ]);

    return new Response(gif, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request);
  }
};
