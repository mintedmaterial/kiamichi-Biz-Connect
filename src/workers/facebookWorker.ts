import { Env } from '../types';
import { DatabaseService } from '../database';

/**
 * Minimal Facebook helper module used by an external worker.
 * - runFacebookWorker(env, db, options?): posts a highlight or blog link to the configured FB group
 * - handleFacebookWebhook(request): verifies and accepts webhook payloads
 *
 * Secrets (set these via `wrangler secret put`) expected in the runtime `env`:
 * - `FB_GROUP_ID`
 * - `FB_ACCESS_TOKEN`
 */

export async function runFacebookWorker(
	env: Env,
	db: DatabaseService,
	options?: { test?: boolean }
): Promise<any> {
	const groupId = env.FB_GROUP_ID;
	const token = env.FB_ACCESS_TOKEN;

	if (!groupId || !token) {
		throw new Error('Facebook configuration missing: FB_GROUP_ID or FB_ACCESS_TOKEN');
	}

	// Choose a post body: prefer featured business, then recent blog post, else a default message
	let message = '';
	let link = env.SITE_URL;

	try {
		const featured = await db.getFeaturedBusinesses(1);
		if (featured && featured.length > 0) {
			const b = featured[0];
			message = `${b.name}${b.description ? ' — ' + b.description.substring(0, 200) : ''}`;
			link = `${env.SITE_URL}/business/${b.slug}?utm_source=facebook&utm_medium=group&utm_campaign=highlight`;
		} else {
			const posts = await db.getRecentBlogPosts(1);
			if (posts && posts.length > 0) {
				const p = posts[0];
				message = `${p.title}\n\n${(p.excerpt || (p.content ? p.content.substring(0, 200) : '') )}`;
				link = `${env.SITE_URL}/blog/${p.slug}?utm_source=facebook&utm_medium=group&utm_campaign=blog_share`;
			} else {
				message = `Kiamichi Biz Connect is live — add your business: ${env.SITE_URL}`;
			}
		}

		if (options?.test) {
			message = `[TEST POST] ${message}`;
		}

		const params = new URLSearchParams();
		params.set('message', message);
		params.set('link', link);
		params.set('access_token', token as string);

		const res = await fetch(`https://graph.facebook.com/${groupId}/feed`, {
			method: 'POST',
			body: params
		});

		const data = await res.json();
		return data;
	} catch (err) {
		console.error('runFacebookWorker error', err);
		throw err;
	}
}

export async function handleFacebookWebhook(request: Request): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === 'GET') {
		const mode = url.searchParams.get('hub.mode');
		const challenge = url.searchParams.get('hub.challenge');
		// In production verify `hub.verify_token` against your expected value
		if (mode === 'subscribe' && challenge) {
			return new Response(challenge, { status: 200 });
		}
		return new Response('Bad Request', { status: 400 });
	}

	if (request.method === 'POST') {
		try {
			const body = await request.json();
			// For now just log the payload. Implement ingestion and privacy checks as needed.
			console.info('Facebook webhook payload:', body);
			return new Response('OK', { status: 200 });
		} catch (err) {
			console.error('Failed to parse Facebook webhook body', err);
			return new Response('Bad Request', { status: 400 });
		}
	}

	return new Response('Method Not Allowed', { status: 405 });
}

