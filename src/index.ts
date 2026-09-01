import { Env, Business } from './types';
import { DatabaseService } from './database';
import { aboutPageContent, advertisePageContent, htmlTemplate, homepageContent, pricingHubPageContent, pricingPageContent } from './templates';
import { handleAdminPage } from './admin';
import {
  getFacebookLoginUrl,
  exchangeCodeForToken,
  getUserPages,
  getPageInfo
} from './facebook-oauth';
import type { FacebookManagedPage, FacebookPageInfo } from './facebook-oauth';
import { handleLogout } from './auth/google';
import {
  handleGitHubLogin,
  handleGitHubCallback
} from './auth/github';
import { requireAdminAuth } from './auth/middleware';
import { runAutomatedDailyBlog } from './workers/blogWorker';
import { getAuctionStatus } from './auction-service';
import { createSponsoredAuctionBid, handleSquareWebhook, isSquareCheckoutConfigured } from './square-auctions';

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('KBC daily blog cron triggered', {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
    });

    const db = new DatabaseService(env.DB);
    ctx.waitUntil(runDailyBlogAutomation(env, db, controller.scheduledTime));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Initialize database service
    const db = new DatabaseService(env.DB);

    // Router
    try {
      if (path === '/health') {
        return Response.json({
          status: 'healthy',
          worker: 'kiamichi-biz-connect',
          timestamp: Date.now(),
          auctionAds: await getAuctionAdsFlagState(env)
        });
      }

      if (path === '/api/flags/auction-ads') {
        return Response.json(await getAuctionAdsFlagState(env));
      }

      // Robots.txt for search engine crawlers
      if (path === '/robots.txt') {
        return new Response(`# Robots.txt for KiamichiBizConnect
# Allow all crawlers

User-agent: *
Allow: /

# Sitemap location
Sitemap: https://kiamichibizconnect.com/sitemap.xml

# Cloudflare AI Search Bot
User-agent: CloudflareBot
Allow: /

# Specific paths for crawlers
Allow: /business/*
Allow: /category/*
Allow: /blog/*

# Block admin and API endpoints from crawlers
Disallow: /admin
Disallow: /api/*
Disallow: /auth/*`, {
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'CDN-Cache-Control': 'max-age=86400'
          }
        });
      }

      // Sitemap.xml for search engines and AI Search
      if (path === '/sitemap.xml') {
        return await handleSitemap(db, env);
      }

      // Serve images from R2 (social media images, blog images, etc.)
      if (path.startsWith('/images/')) {
        const imageKey = path.substring(8); // Remove '/images/' prefix

        try {
          const object = await env.IMAGES.get(imageKey);

          if (!object) {
            return new Response('Image not found', { status: 404 });
          }

          // Determine content type based on file extension
          const extension = imageKey.split('.').pop()?.toLowerCase();
          const contentTypeMap: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
          };
          const contentType = contentTypeMap[extension || 'png'] || 'application/octet-stream';

          return new Response(object.body, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year (images don't change)
              'CDN-Cache-Control': 'max-age=31536000',
              'ETag': object.etag || ''
            }
          });
        } catch (error: any) {
          console.error('Error serving image from R2:', error);
          return new Response('Error retrieving image', { status: 500 });
        }
      }

      // Homepage
      if (path === '/' || path === '') {
        return await handleHomepage(db, env);
      }

      // Search
      if (path === '/search') {
        return await handleSearch(request, db, env);
      }

      // Categories list
      if (path === '/categories') {
        return await handleCategoriesList(db, env);
      }

      // Category page
      if (path.startsWith('/category/')) {
        const slug = path.split('/')[2];
        return await handleCategoryPage(request, slug, db, env);
      }

      // Business detail page
      if (path.startsWith('/business/')) {
        const slug = path.split('/')[2];
        return await handleBusinessPage(slug, db, env);
      }

      // Business submission form
      if (path === '/submit') {
        if (request.method === 'GET') {
          return await handleSubmitForm(db, env);
        } else if (request.method === 'POST') {
          return await handleSubmitBusiness(request, db, env);
        }
      }

      // API endpoints
      if (path.startsWith('/api/')) {
        return await handleAPI(path, request, db, env);
      }

      // GitHub OAuth routes (admin authentication)
      if (path === '/auth/github/login') {
        return await handleGitHubLogin(request, env);
      }

      if (path === '/auth/callback/github') {
        return await handleGitHubCallback(request, env, db);
      }

      // Logout (works for both Google and Facebook)
      if (path === '/auth/logout') {
        return await handleLogout(request, env, db);
      }

      // Business Agent redirect (protected)
      if (path === '/chat' || path === '/agent') {
        const authResult = await requireAdminAuth(request, env, db);

        if (!authResult.authorized) {
          return Response.redirect(new URL('/auth/github/login', request.url).toString(), 302);
        }

        // Authenticated - get session ID and ensure cookie is set for subdomain
        const cookies = request.headers.get('Cookie');
        const sessionMatch = cookies?.match(/admin_session=([^;]+)/);

        if (sessionMatch) {
          const sessionId = sessionMatch[1];
          // Redirect with cookie explicitly set for subdomain
          return new Response(null, {
            status: 302,
            headers: {
              'Location': 'https://app.kiamichibizconnect.com',
              'Set-Cookie': `admin_session=${sessionId}; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=None; Max-Age=86400; Path=/`
            }
          });
        }

        // Fallback redirect if no session found
        return Response.redirect('https://app.kiamichibizconnect.com', 302);
      }

      // Admin panel (protected)
      if (path.startsWith('/admin')) {
        return await handleAdminPage(request, env);
      }

      // Facebook OAuth routes
      if (path.startsWith('/auth/facebook')) {
        return await handleFacebookAuth(path, request, env);
      }

      // Individual blog post (must come before /blog to match first)
      if (path.startsWith('/blog/') && path !== '/blog/') {
        const slug = path.split('/')[2];
        if (slug) {
          return await handleBlogPost(slug, db, env);
        }
      }

      // Blog listing
      if (path === '/blog') {
        return await handleBlog(db, env);
      }

      // Serve logo from R2
      if (path === '/logo.png') {
        const object = await env.IMAGES.get('logo.png');
        if (!object) {
          return new Response('Logo not found', { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000'
          }
        });
      }

      // Serve blog images from R2
      if (path.startsWith('/images/blog/')) {
        const imageKey = path.slice(8); // Remove '/images/' prefix to get 'blog/...'
        const object = await env.IMAGES.get(imageKey);
        if (!object) {
          return new Response('Image not found', { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'image/png',
            'Cache-Control': 'public, max-age=2592000' // 30 days
          }
        });
      }

      // Privacy Policy page (required for Facebook App settings)
      if (path === '/privacy') {
        const content = `
          <div class="container mx-auto px-4 py-12 max-w-3xl">
            <h1 class="text-4xl font-bold mb-6">Privacy Policy</h1>
            <p class="mb-4">Kiamichi Biz Connect collects and stores information submitted by businesses and users to provide directory and lead generation services. We respect user privacy and allow people to request deletion of their data.</p>
            <h2 class="text-2xl font-bold mt-6 mb-3">Data Deletion</h2>
            <p class="mb-3">If you would like to request deletion of data associated with your Facebook account, please use the Facebook App Data Deletion flow — our Data Deletion Callback URL is provided in the App settings. You can also email <a href="mailto:${env.ADMIN_EMAIL}" class="text-[#ED5409]">${env.ADMIN_EMAIL}</a> with the details and we will process the request.</p>
            <h2 class="text-2xl font-bold mt-6 mb-3">Contact</h2>
            <p class="mb-3">For privacy questions, email <a href="mailto:${env.ADMIN_EMAIL}" class="text-[#ED5409]">${env.ADMIN_EMAIL}</a>.</p>
          </div>
        `;
        return new Response(htmlTemplate('Privacy Policy', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // Terms of Service page (required for Facebook App settings)
      if (path === '/terms') {
        const content = `
          <div class="container mx-auto px-4 py-12 max-w-3xl">
            <h1 class="text-4xl font-bold mb-6">Terms of Service</h1>
            <p class="mb-4">By using Kiamichi Biz Connect you agree to our terms for providing business listings and related services. Businesses must provide accurate and lawful information. We reserve the right to remove content that violates our guidelines.</p>
            <h2 class="text-2xl font-bold mt-6 mb-3">Acceptable Use</h2>
            <p class="mb-3">Users and businesses must not post illegal, harassing, or infringing content. Advertising and sponsored placements are subject to additional terms.</p>
            <h2 class="text-2xl font-bold mt-6 mb-3">Contact</h2>
            <p class="mb-3">Questions about these terms: <a href="mailto:${env.ADMIN_EMAIL}" class="text-[#ED5409]">${env.ADMIN_EMAIL}</a>.</p>
          </div>
        `;
        return new Response(htmlTemplate('Terms of Service', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // About page
      if (path === '/about') {
        let stats = { businesses: 0, categories: 0, cities: 3 };
        try {
          stats = await db.getStats();
        } catch (error) {
          console.warn('About stats unavailable; using fallback preview values', error);
        }
        const content = aboutPageContent({ stats });
        return new Response(htmlTemplate('About Us', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // Advertising page
      if (path === '/advertise') {
        if (!(await isAuctionAdsEnabled(env))) {
          return new Response(htmlTemplate('Advertising Unavailable', pricingHubPageContent(), env), {
            headers: { 'Content-Type': 'text/html' },
            status: 503
          });
        }
        let localAuction = null;
        let regionalAuction = null;
        try {
          [localAuction, regionalAuction] = await Promise.all([
            getAuctionStatus(env.DB, 'local-spotlight'),
            getAuctionStatus(env.DB, 'regional-spotlight')
          ]);
        } catch (error) {
          console.warn('Auction status unavailable; using fallback preview values', error);
        }
        const content = advertisePageContent({ localAuction, regionalAuction });
        return new Response(htmlTemplate('Advertise', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // Auction advertising pricing page
      if (path === '/advertise/pricing') {
        if (!(await isAuctionAdsEnabled(env))) {
          return new Response(htmlTemplate('Pricing', pricingHubPageContent(), env), {
            headers: { 'Content-Type': 'text/html' },
            status: 503
          });
        }
        let localAuction = null;
        let regionalAuction = null;
        try {
          [localAuction, regionalAuction] = await Promise.all([
            getAuctionStatus(env.DB, 'local-spotlight'),
            getAuctionStatus(env.DB, 'regional-spotlight')
          ]);
        } catch (error) {
          console.warn('Auction pricing unavailable; using fallback preview values', error);
        }
        const content = pricingPageContent({ localAuction, regionalAuction });
        return new Response(htmlTemplate('Auction Ad Pricing', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // Pricing page
      if (path === '/pricing') {
        const content = pricingHubPageContent();
        return new Response(htmlTemplate('Pricing', content, env), { headers: { 'Content-Type': 'text/html' } });
      }

      // 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

async function runDailyBlogAutomation(env: Env, db: DatabaseService, scheduledTime: number): Promise<void> {
  console.log('Preparing automated KBC daily blog run', { scheduledTime });

  const automated = await runAutomatedDailyBlog(env, db);
  if (!automated.success || !automated.blog_id) {
    throw new Error(automated.error || 'Automated blog worker did not return a published blog_id');
  }

  console.log('KBC daily blog published', {
    blog_id: automated.blog_id,
    title: automated.title,
    slug: automated.slug,
    type: automated.strategy,
    featured_image: automated.featured_image,
    image_auto_approved: automated.image_auto_approved,
    selection_reason: automated.selection_reason,
  });
}

// Homepage handler
async function handleHomepage(db: DatabaseService, env: Env): Promise<Response> {
  const fallbackCategories = [
    { slug: 'home-services', name: 'Home Services', icon: '🏠' },
    { slug: 'automotive', name: 'Automotive', icon: '🚗' },
    { slug: 'food-dining', name: 'Food & Dining', icon: '🍽️' },
    { slug: 'beauty-personal-care', name: 'Beauty', icon: '💇' },
    { slug: 'retail-shopping', name: 'Retail', icon: '🛍️' }
  ];
  const fallbackFeatured = [
    { slug: 'maple-tree-roofing', name: 'Maple Tree Roofing', city: 'Paris', state: 'TX', description: 'Roofing, storm repairs, and replacement estimates for regional homeowners.', is_verified: true, google_rating: 4.9, google_review_count: 37, image_url: null },
    { slug: 'red-river-auto-spa', name: 'Red River Auto Spa', city: 'Idabel', state: 'OK', description: 'Full-service auto detailing and interior refreshes.', is_verified: true, google_rating: 4.8, google_review_count: 24, image_url: null },
    { slug: 'pine-crest-hardware', name: 'Pine Crest Hardware', city: 'Broken Bow', state: 'OK', description: 'Local hardware and project supplies for homeowners and contractors.', is_verified: false, google_rating: 4.7, google_review_count: 19, image_url: null }
  ];

  let categories = fallbackCategories;
  let featured = fallbackFeatured;
  let sponsored: any[] = [];
  let stats = { businesses: 0, categories: fallbackCategories.length, cities: 3 };
  let blogPosts: any[] = [];

  try {
    [categories, featured, sponsored, stats, blogPosts] = await Promise.all([
      db.getAllCategories(),
      db.getFeaturedBusinesses(6),
      db.getActiveAdPlacements('homepage-featured'),
      db.getStats(),
      db.getRecentBlogPosts(3)
    ]);
  } catch (error) {
    console.warn('Homepage data unavailable; using fallback preview content', error);
  }

  const sponsorTicker = [
    ...sponsored.map((business) => ({ ...business, kind: 'Sponsored' })),
    ...featured.map((business) => ({ ...business, kind: 'Featured' }))
  ].slice(0, 8);
  const content = homepageContent({ categories, featured, sponsored, sponsorTicker, stats, blogPosts });
  const html = htmlTemplate('Home - Find Local Businesses', content, env);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

const LISTING_PAGE_SIZE = 15;

function getPageNumber(url: URL): number {
  const raw = Number.parseInt(url.searchParams.get('page') || '1', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function listingCard(business: any, featured = false): string {
  const imageHtml = business.image_url
    ? `<img src="${business.image_url}" alt="${business.name}" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">`
    : business.facebook_image_url
      ? `<img src="${business.facebook_image_url}" alt="${business.name}" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
      : `<div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,203,103,.45),rgba(237,84,9,.95))] flex items-center justify-center"><span class="text-5xl">🏪</span></div>`;

  return `
    <a href="/business/${business.slug}" class="group overflow-hidden rounded-3xl border border-white/10 bg-[#111827] shadow-[0_20px_60px_rgba(0,0,0,.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FFCB67]/40 hover:shadow-[0_24px_70px_rgba(237,84,9,.18)] reveal-on-scroll" data-reveal>
      <div class="relative aspect-[16/10] bg-gradient-to-br from-[#FFCB67] to-[#ED5409] overflow-hidden">
        ${imageHtml}
        ${featured ? '<div class="absolute top-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-[#FFCB67] backdrop-blur">Featured</div>' : ''}
        <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent"></div>
      </div>
      <div class="bg-white px-5 py-5 text-slate-900">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="text-[1.7rem] font-black leading-[0.95] tracking-[-0.03em] text-slate-900 uppercase break-words">${business.name}</h3>
            <p class="mt-3 text-lg font-semibold text-slate-500">${business.city}, ${business.state}</p>
          </div>
          ${business.is_verified ? '<span class="mt-1 shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-700">Verified</span>' : ''}
        </div>
        ${business.description ? `<p class="mt-4 text-[1.04rem] leading-7 text-slate-700 line-clamp-3">${business.description}</p>` : ''}
        <div class="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <div class="flex items-center gap-2 text-base text-slate-500">
            ${business.google_rating ? `<span class="text-amber-500 text-lg">★</span><span class="font-semibold text-slate-700">${business.google_rating.toFixed(1)}</span><span>(${business.google_review_count || 0})</span>` : '<span>No reviews yet</span>'}
          </div>
          <span class="text-sm font-bold uppercase tracking-widest text-[#ED5409]">View</span>
        </div>
      </div>
    </a>
  `;
}

function listingGrid(businesses: any[], featured = false): string {
  return businesses.map((business) => listingCard(business, featured)).join('');
}

function renderLoadingGrid(count = LISTING_PAGE_SIZE): string {
  return Array.from({ length: count }).map(() => `
    <div class="overflow-hidden rounded-3xl border border-white/10 bg-[#111827] shadow-[0_20px_60px_rgba(0,0,0,.18)]">
      <div class="aspect-[16/10] bg-gradient-to-br from-slate-700 via-slate-800 to-slate-700 animate-pulse"></div>
      <div class="bg-white px-5 py-5">
        <div class="h-8 w-4/5 rounded bg-slate-200 animate-pulse"></div>
        <div class="mt-3 h-5 w-2/5 rounded bg-slate-200 animate-pulse"></div>
        <div class="mt-4 h-4 w-full rounded bg-slate-200 animate-pulse"></div>
        <div class="mt-2 h-4 w-5/6 rounded bg-slate-200 animate-pulse"></div>
        <div class="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
          <div class="h-5 w-28 rounded bg-slate-200 animate-pulse"></div>
          <div class="h-4 w-14 rounded bg-slate-200 animate-pulse"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function listingControls({ total, shown, page, hasMore, nextPageUrl, label }: { total: number; shown: number; page: number; hasMore: boolean; nextPageUrl: string; label: string; }): string {
  return `
    <div class="mt-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#111827] p-5 text-white md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-slate-400">Results</p>
        <p class="mt-1 text-lg font-semibold text-white" data-listings-summary>Showing ${shown} of ${total} ${label}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">Page ${page}</span>
        ${hasMore ? `<button id="loadMoreListings" data-next-page-url="${nextPageUrl}" class="rounded-full bg-[#ED5409] px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(237,84,9,.28)]">Load more</button>` : ''}
      </div>
    </div>
    <script>
      (() => {
        const grid = document.querySelector('[data-listings-grid]');
        const button = document.getElementById('loadMoreListings');
        const counter = document.querySelector('[data-listings-summary]');
        if (!grid || !button) return;
        button.addEventListener('click', async () => {
          const nextUrl = new URL(button.dataset.nextPageUrl, window.location.origin);
          button.disabled = true;
          button.textContent = 'Loading...';
          try {
            const res = await fetch(nextUrl.toString() + '&partial=1', { headers: { 'X-Requested-With': 'fetch' } });
            const data = await res.json();
            grid.insertAdjacentHTML('beforeend', data.html);
            if (counter) counter.textContent = 'Showing ' + data.shown + ' of ' + data.total + ' ' + data.label;
            const nextPage = data.page + 1;
            const url = new URL(window.location.href);
            url.searchParams.set('page', String(data.page));
            url.searchParams.delete('partial');
            history.pushState({}, '', url.toString());
            if (data.hasMore) {
              const next = new URL(window.location.href);
              next.searchParams.set('page', String(nextPage));
              button.dataset.nextPageUrl = next.toString();
              button.textContent = 'Load more';
              button.disabled = false;
            } else {
              button.remove();
            }
            document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
          } catch (error) {
            button.disabled = false;
            button.textContent = 'Load more';
            console.error(error);
          }
        });

        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          }
        }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });
        document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
        window.addEventListener('scroll', () => {}, { passive: true });
      })();
    </script>
  `;
}

function renderFallbackCategoryPage(slug: string, env: Env): Response {
  const title = slug
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const mockBusinesses = [
    {
      slug: `${slug}-preview-one`,
      name: `${title} Co.`,
      city: 'Atoka',
      state: 'OK',
      description: 'Local preview listing shown until the database tables are available.'
    },
    {
      slug: `${slug}-preview-two`,
      name: `Riverbend ${title}`,
      city: 'Paris',
      state: 'TX',
      description: 'Fallback card used to verify the new grid, spacing, and motion.'
    },
    {
      slug: `${slug}-preview-three`,
      name: `${title} Services`,
      city: 'Broken Bow',
      state: 'OK',
      description: 'Once the D1 schema is present, this page will render live businesses here.'
    }
  ];

  const content = `
    <div class="relative overflow-hidden bg-[#0b0f14] text-white">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(237,84,9,.32),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(255,203,103,.14),transparent_32%)]"></div>
      <div class="container mx-auto px-4 py-16 relative z-10">
        <div class="max-w-4xl">
          <p class="text-sm uppercase tracking-[0.32em] text-[#FFCB67]">Directory category</p>
          <div class="mt-4 flex items-start gap-5">
            <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-5xl shadow-[0_16px_40px_rgba(0,0,0,.25)]">📁</div>
            <div>
              <h1 class="text-4xl font-black tracking-[-0.04em] md:text-6xl">${title}</h1>
              <p class="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Local preview mode is showing fallback businesses because the local database schema is empty.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-12">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm uppercase tracking-[0.28em] text-slate-500">Browse local businesses</p>
        <a href="/submit" class="rounded-full border border-[#ED5409]/30 bg-[#ED5409]/10 px-4 py-2 text-sm font-semibold text-[#ED5409] transition hover:bg-[#ED5409] hover:text-white">Add your business</a>
      </div>
      <div class="mt-6">
        ${listingControls({ total: mockBusinesses.length, shown: mockBusinesses.length, page: 1, hasMore: false, nextPageUrl: '#', label: title })}
      </div>
      <div data-listings-grid class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        ${listingGrid(mockBusinesses)}
      </div>
    </div>
  `;

  const html = htmlTemplate(`${title} Businesses`, content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Sitemap handler for search engines and AI Search
async function handleSitemap(db: DatabaseService, env: Env): Promise<Response> {
  const siteUrl = env.SITE_URL || 'https://kiamichibizconnect.com';

  // Try to get cached sitemap from KV (cache for 1 hour)
  const cacheKey = 'sitemap:xml';
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
        'CDN-Cache-Control': 'max-age=3600',
        'X-Cache': 'HIT'
      }
    });
  }

  // Get all active businesses
  const businesses = await db.db.prepare(`
    SELECT slug, updated_at FROM businesses
    WHERE is_active = 1
    ORDER BY updated_at DESC
  `).all();

  // Get all categories
  const categories = await db.getAllCategories();

  // Get all published blog posts
  const blogPosts = await db.db.prepare(`
    SELECT slug, updated_at FROM blog_posts
    WHERE is_published = 1
    ORDER BY updated_at DESC
  `).all();

  // Build sitemap XML
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>

  <!-- Categories Page -->
  <url>
    <loc>${siteUrl}/categories</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Blog Page -->
  <url>
    <loc>${siteUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Submit Page -->
  <url>
    <loc>${siteUrl}/submit</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;

  // Add all categories
  for (const category of categories) {
    sitemap += `  <url>
    <loc>${siteUrl}/category/${category.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  // Add all businesses
  if (businesses.results) {
    for (const business of businesses.results) {
      const lastmod = business.updated_at
        ? new Date(business.updated_at * 1000).toISOString()
        : new Date().toISOString();

      sitemap += `  <url>
    <loc>${siteUrl}/business/${business.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
    }
  }

  // Add all blog posts
  if (blogPosts.results) {
    for (const post of blogPosts.results) {
      const lastmod = post.updated_at
        ? new Date(post.updated_at * 1000).toISOString()
        : new Date().toISOString();

      sitemap += `  <url>
    <loc>${siteUrl}/blog/${post.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
    }
  }

  sitemap += `</urlset>`;

  // Store in KV cache for 1 hour
  await env.CACHE.put(cacheKey, sitemap, { expirationTtl: 3600 });

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'max-age=3600',
      'X-Cache': 'MISS'
    }
  });
}

// Search handler with AI Search integration
async function handleSearch(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const url = new URL(request.url);
  let query = url.searchParams.get('q') || '';
  let category = url.searchParams.get('category') || '';
  const city = url.searchParams.get('city') || '';

  // Extract category from natural language query if not explicitly set
  if (!category && query) {
    const categoryKeywords: Record<string, string> = {
      'home services': 'home-services',
      'automotive': 'automotive',
      'restaurant': 'food-dining',
      'food': 'food-dining',
      'dining': 'food-dining',
      'health': 'health-wellness',
      'fitness': 'health-wellness',
      'beauty': 'beauty-personal-care',
      'salon': 'beauty-personal-care',
      'professional': 'professional-services',
      'real estate': 'real-estate-property',
      'retail': 'retail-shopping',
      'shopping': 'retail-shopping',
      'education': 'education-training',
      'entertainment': 'entertainment-recreation'
    };

    const lowerQuery = query.toLowerCase();
    for (const [keyword, slug] of Object.entries(categoryKeywords)) {
      if (lowerQuery.includes(keyword)) {
        category = slug;
        // Remove stop words for better database search
        query = query.replace(/\b(best|good|great|top|find|near me|looking for)\b/gi, '').trim();
        break;
      }
    }
  }

  // Always run database search
  const results = await db.searchBusinesses({ query, category, city, limit: 20 });

  // Check if query is a natural language question
  const isNaturalLanguage = query.length > 15 || /\b(what|where|who|when|why|how|best|find|looking for|need|recommend|suggest)\b/i.test(query);

  let aiAnswer = '';
  let aiBusinessLinks: Array<{name: string, url: string, description: string}> = [];
  if (isNaturalLanguage) {
    try {
      // Call NLWeb AI Search worker
      const nlwebResponse = await fetch('https://purple-snow-f107-nlweb.srvcflo.workers.dev/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (nlwebResponse.ok) {
        const text = await nlwebResponse.text();

        // Parse streaming response to extract results
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.message_type === 'result_batch' && data.results) {
                const rawResults = data.results.filter((r: any) =>
                  r.url && r.url.includes('/business/')
                ).slice(0, 5); // Top 5 business pages only

                // Extract clean business info from URLs
                for (const result of rawResults) {
                  try {
                    const urlPath = result.url;
                    const slug = urlPath.split('/business/').pop()?.split('?')[0];

                    if (slug && slug.length > 0 && !slug.includes('/')) {
                      // Get business from database for clean info
                      const business = await db.db.prepare('SELECT * FROM businesses WHERE slug = ? AND is_active = 1').bind(slug).first();

                      if (business) {
                        aiBusinessLinks.push({
                          name: business.name,
                          url: `/business/${slug}`,
                          description: business.description || `${business.name} in ${business.city}, ${business.state}`
                        });
                      }
                    }
                  } catch (err) {
                    console.error('Error processing AI result:', err);
                  }
                }

                // Generate clean answer with links
                if (aiBusinessLinks.length > 0) {
                  aiAnswer = `Based on your search, I found ${aiBusinessLinks.length} relevant businesses:`;
                }
              }
            } catch (e) {
              console.error('AI parse error:', e);
              // Skip malformed JSON lines
            }
          }
        }
      }
    } catch (error) {
      console.error('AI Search error:', error);
      // Continue without AI answer if it fails
    }
  }

  const content = `
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-6">Search Results</h1>

      ${aiAnswer && aiBusinessLinks.length > 0 ? `
        <div class="glow-card rounded-xl p-6 mb-8 border-2 border-[#FFCB67]/30">
          <div class="flex items-start gap-3 mb-4">
            <span class="text-2xl">🤖</span>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-[#FFCB67] mb-2">AI Assistant</h2>
              <p class="text-gray-300 mb-4">${aiAnswer}</p>

              <div class="grid grid-cols-1 gap-3">
                ${aiBusinessLinks.map((biz, i) => `
                  <a href="${biz.url}" class="block bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-4 transition-all border border-[#FFCB67]/20 hover:border-[#FFCB67]/50">
                    <div class="flex items-start gap-3">
                      <span class="text-[#FFCB67] font-bold text-lg">${i + 1}.</span>
                      <div class="flex-1">
                        <h3 class="text-lg font-bold text-gray-100 mb-1">${biz.name}</h3>
                        <p class="text-gray-400 text-sm line-clamp-2">${biz.description}</p>
                        <span class="text-[#ED5409] text-sm mt-2 inline-block hover:underline">View Details →</span>
                      </div>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      ${results.data.length === 0 && aiBusinessLinks.length === 0 ? `
        <div class="glow-card rounded-lg p-8 text-center">
          <p class="text-xl text-gray-300">No businesses found matching your search.</p>
          <p class="text-gray-400 mt-2">Try adjusting your search criteria or <a href="/" class="text-[#ED5409] underline">browse all categories</a></p>
        </div>
      ` : results.data.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${results.data.map(business => `
            <a href="/business/${business.slug}" class="card-hover glow-card rounded-xl overflow-hidden">
              <div class="h-40 bg-gradient-to-br from-[#FFCB67] to-[#FFA59D] flex items-center justify-center relative overflow-hidden">
                ${business.image_url ?
                  `<img src="${business.image_url}" alt="${business.name}" class="w-full h-full object-cover">` :
                  (business as any).facebook_image_url ?
                  `<img src="${(business as any).facebook_image_url}" alt="${business.name}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <span class="hidden text-5xl">🏪</span>` :
                  `<span class="text-5xl">🏪</span>`
                }
              </div>
              <div class="p-4">
                <h3 class="text-lg font-bold text-gray-100 mb-1">${business.name}</h3>
                <p class="text-gray-400 text-sm mb-2">${business.city}, ${business.state}</p>
                ${business.description ? `<p class="text-gray-300 text-sm mb-3 line-clamp-2">${business.description}</p>` : ''}
                <div class="flex items-center">
                  ${business.google_rating ? `
                    <span class="text-yellow-400">⭐</span>
                    <span class="ml-1 font-semibold text-primary">${business.google_rating.toFixed(1)}</span>
                    <span class="ml-1 text-secondary text-sm">(${business.google_review_count || 0})</span>
                  ` : '<span class="text-secondary text-sm">No reviews yet</span>'}
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  const html = htmlTemplate('Search Results', content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Category page handler
async function handleCategoryPage(request: Request, slug: string, db: DatabaseService, env: Env): Promise<Response> {
  const category = await db.getCategoryBySlug(slug);
  if (!category) {
    return renderFallbackCategoryPage(slug, env);
  }

  const url = new URL(request.url);
  const page = getPageNumber(url);
  const offset = (page - 1) * LISTING_PAGE_SIZE;
  const partial = url.searchParams.get('partial') === '1';
  const results = await db.searchBusinesses({ category: slug, limit: LISTING_PAGE_SIZE, offset });
  const totalPages = Math.max(1, Math.ceil(results.total / LISTING_PAGE_SIZE));

  const nextPageUrl = new URL(url.toString());
  nextPageUrl.searchParams.set('page', String(page + 1));
  nextPageUrl.searchParams.delete('partial');

  if (partial) {
    return new Response(JSON.stringify({
      html: listingGrid(results.data),
      total: results.total,
      shown: Math.min(page * LISTING_PAGE_SIZE, results.total),
      page,
      hasMore: results.hasMore,
      label: category.name
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const content = `
    <div class="relative overflow-hidden bg-[#0b0f14] text-white">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(237,84,9,.32),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(255,203,103,.14),transparent_32%)]"></div>
      <div class="container mx-auto px-4 py-16 relative z-10">
        <div class="max-w-4xl">
          <p class="text-sm uppercase tracking-[0.32em] text-[#FFCB67]">Directory category</p>
          <div class="mt-4 flex items-start gap-5">
            <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-5xl shadow-[0_16px_40px_rgba(0,0,0,.25)]">${category.icon || '📁'}</div>
            <div>
              <h1 class="text-4xl font-black tracking-[-0.04em] md:text-6xl">${category.name}</h1>
              <p class="mt-4 max-w-2xl text-lg leading-8 text-slate-300">${category.description || ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-12">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.28em] text-slate-500">Browse local businesses</p>
          <p class="mt-1 text-sm text-slate-400">Showing ${Math.min(page * LISTING_PAGE_SIZE, results.total)} of ${results.total} ${category.name}</p>
        </div>
        <a href="/submit" class="rounded-full border border-[#ED5409]/30 bg-[#ED5409]/10 px-4 py-2 text-sm font-semibold text-[#ED5409] transition hover:bg-[#ED5409] hover:text-white">Add your business</a>
      </div>

      <div data-listings-grid class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        ${listingGrid(results.data)}
      </div>

      ${results.hasMore ? `
        <div class="mt-8 flex justify-center">
          <button id="loadMoreListings" data-next-page-url="${nextPageUrl.toString()}" class="rounded-full bg-[#ED5409] px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(237,84,9,.28)]">
            Load more
          </button>
        </div>
      ` : ''}
    </div>

    <script>
      (() => {
        const grid = document.querySelector('[data-listings-grid]');
        const button = document.getElementById('loadMoreListings');
        if (!grid || !button) return;
        button.addEventListener('click', async () => {
          const nextUrl = new URL(button.dataset.nextPageUrl, window.location.origin);
          button.disabled = true;
          button.textContent = 'Loading...';
          try {
            const res = await fetch(nextUrl.toString() + '&partial=1', { headers: { 'X-Requested-With': 'fetch' } });
            const data = await res.json();
            grid.insertAdjacentHTML('beforeend', data.html);
            const nextPage = data.page + 1;
            const url = new URL(window.location.href);
            url.searchParams.set('page', String(data.page));
            url.searchParams.delete('partial');
            history.pushState({}, '', url.toString());
            if (data.hasMore) {
              const next = new URL(window.location.href);
              next.searchParams.set('page', String(nextPage));
              button.dataset.nextPageUrl = next.toString();
              button.textContent = 'Load more';
              button.disabled = false;
            } else {
              button.remove();
            }
            document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
          } catch (error) {
            button.disabled = false;
            button.textContent = 'Load more';
            console.error(error);
          }
        });

        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          }
        }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });
        document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
      })();
    </script>
  `;

  const html = htmlTemplate(`${category.name} Businesses`, content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}


// Render Facebook posts section
async function renderFacebookPosts(businessId: number, db: DatabaseService, env: Env): Promise<string> {
  try {
    const posts = await env.DB.prepare(`
      SELECT * FROM facebook_posts
      WHERE business_id = ?
      ORDER BY ai_quality_score DESC
      LIMIT 3
    `).bind(businessId).all();

    if (!posts.results || posts.results.length === 0) {
      return '';
    }

    const postCards = posts.results.map((post: any) => {
      const tags = post.relevance_tags ? JSON.parse(post.relevance_tags) : [];
      return `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="p-4 border-b bg-gray-50">
            <div class="flex justify-between items-start mb-2">
              <div class="flex gap-2 flex-wrap">
                ${tags.map((tag: string) => `
                  <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">${tag}</span>
                `).join('')}
              </div>
              <span class="text-sm font-bold text-green-600">${post.ai_quality_score}/100</span>
            </div>
            <div class="flex gap-4 text-sm text-gray-600">
              <span>❤️ ${post.likes_count}</span>
              <span>💬 ${post.comments_count}</span>
              ${post.shares_count > 0 ? `<span>🔄 ${post.shares_count}</span>` : ''}
            </div>
          </div>
          <div class="aspect-[500/500] overflow-hidden">
            ${post.embed_code}
          </div>
          <div class="p-4 bg-gray-50">
            <a href="${post.post_url}" target="_blank" class="text-blue-600 hover:text-blue-700 font-semibold text-sm">
              View on Facebook →
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="mt-12">
        <h2 class="text-3xl font-bold mb-6">Featured Posts</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${postCards}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error rendering Facebook posts:', error);
    return '';
  }
}

// Business detail page
const UPGRADED_PAGE_KEYS: Record<string, string> = {
  'srvcflo-web-marketing-design': 'pages/srvcflo-web-marketing-design/index.html',
  srvcflo: 'pages/srvcflo/index.html',
  'twisted-custom-leather': 'pages/twisted-custom-leather/index.html',
  'velvet-fringe': 'pages/velvet-fringe/index.html'
};

async function tryPublishedBusinessPage(slug: string, env: Env): Promise<Response | null> {
  try {
    const upgradedKey = UPGRADED_PAGE_KEYS[slug];
    if (upgradedKey) {
      const upgradedObject = await env.BUSINESS_ASSETS.get(upgradedKey);
      if (upgradedObject) {
        return new Response(upgradedObject.body, {
          headers: {
            'Content-Type': upgradedObject.httpMetadata?.contentType || 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'ETag': upgradedObject.etag || '',
            'X-KBC-Page-Source': 'upgraded-listing-r2'
          }
        });
      }
    }

    const published = await env.DB.prepare(`
      SELECT p.r2_key, p.html_hash, p.published_at
      FROM published_pages_r2 p
      INNER JOIN listing_pages lp ON lp.id = p.listing_page_id
      INNER JOIN businesses b ON b.id = lp.business_id
      WHERE b.slug = ? AND b.is_active = 1 AND lp.is_published = 1
      ORDER BY p.published_at DESC
      LIMIT 1
    `).bind(slug).first<{ r2_key: string; html_hash: string; published_at: number }>();

    if (!published) return null;

    // Only serve the two page key conventions owned by KBC's publisher.
    const allowedKeys = new Set([
      `business/${slug}/index.html`,
      `pages/${slug}/index.html`
    ]);
    if (!allowedKeys.has(published.r2_key)) {
      console.error('Rejected published page key outside slug allowlist', { slug, key: published.r2_key });
      return null;
    }

    const object = await env.BUSINESS_ASSETS.get(published.r2_key);
    if (!object) return null;

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'ETag': object.etag || published.html_hash,
        'X-KBC-Page-Source': 'published-r2'
      }
    });
  } catch (error) {
    // Older deployments may not have the portal tables yet. Preserve the
    // existing plain listing renderer as the safe compatibility path.
    console.warn('Published page lookup unavailable; using plain listing', error);
    return null;
  }
}

async function renderBusinessImageCarousel(business: Business, env: Env): Promise<string> {
  try {
    const listed = await env.BUSINESS_IMAGES.list({ prefix: `businesses/${business.slug}/`, limit: 24 });
    const imageObjects = listed.objects.filter((object) => /\.(avif|gif|jpe?g|png|webp)$/i.test(object.key));
    if (imageObjects.length === 0) return '';

    const publicBase = (env.BUSINESS_IMAGES_PUBLIC_URL || '').replace(/\/$/, '');
    if (!publicBase) return '';

    const cards = imageObjects.map((object, index) => {
      const publicUrl = `${publicBase}/${object.key.split('/').map(encodeURIComponent).join('/')}`;
      return `<figure class="min-w-[82%] sm:min-w-[48%] lg:min-w-[31%] snap-start overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <img src="${publicUrl}" alt="${escapeHtml(business.name)} gallery image ${index + 1}" class="h-64 w-full object-cover" loading="lazy" decoding="async">
      </figure>`;
    }).join('');

    return `<section class="mt-12" aria-labelledby="business-gallery-heading">
      <div class="flex items-end justify-between gap-4 mb-4">
        <div>
          <p class="text-xs uppercase tracking-widest text-gray-500">Business gallery</p>
          <h2 id="business-gallery-heading" class="text-3xl font-bold">More from ${escapeHtml(business.name)}</h2>
        </div>
        <span class="text-sm text-gray-500">Swipe to explore</span>
      </div>
      <div class="flex snap-x gap-4 overflow-x-auto pb-3">${cards}</div>
    </section>`;
  } catch (error) {
    console.warn('Business gallery unavailable', { businessId: business.id, error });
    return '';
  }
}

async function handleBusinessPage(slug: string, db: DatabaseService, env: Env): Promise<Response> {
  const publishedResponse = await tryPublishedBusinessPage(slug, env);
  if (publishedResponse) return publishedResponse;

  const business = await db.getBusinessBySlug(slug);
  if (!business) {
    return new Response('Business not found', { status: 404 });
  }

  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="bg-white rounded-xl shadow-xl overflow-hidden">
        <!-- Hero Image Header -->
        <div class="relative h-96 bg-gradient-to-br from-[#FFCB67] to-[#FFA59D] flex items-center justify-center overflow-hidden">
          ${business.image_url ?
            // Primary: Use hero image if available
            `<img src="${business.image_url}" alt="${business.name}" class="w-full h-full object-cover">
             <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>` :
            (business as any).facebook_image_url ?
            // Fallback: Use Facebook profile image
            `<img src="${(business as any).facebook_image_url}"
              alt="${business.name}"
              class="w-full h-full object-cover"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
             <div class="hidden w-full h-full items-center justify-center">
               <span class="text-8xl">🏪</span>
             </div>` :
            // Final fallback: Show icon
            `<span class="text-8xl">🏪</span>`
          }

          <!-- Business Name Overlay (clickable to website) -->
          <div class="absolute bottom-0 left-0 right-0 p-8 text-white">
            ${business.website ? `
              <a href="${business.website}" target="_blank" class="hover:opacity-90 transition-opacity">
                <h1 class="text-5xl font-bold mb-2 drop-shadow-lg">${business.name}</h1>
                <p class="text-lg opacity-90">Visit Website →</p>
              </a>
            ` : `
              <h1 class="text-5xl font-bold mb-2 drop-shadow-lg">${business.name}</h1>
            `}
            ${business.is_verified ? '<span class="inline-block mt-2 bg-blue-500 px-3 py-1 rounded-full text-sm">✓ Verified</span>' : ''}
          </div>
        </div>

        <div class="p-8">

          ${business.google_rating ? `
          <div class="flex items-center mb-6">
            <span class="text-yellow-400 text-2xl">⭐</span>
            <span class="ml-2 text-2xl font-bold">${business.google_rating.toFixed(1)}</span>
            <span class="ml-2 text-gray-500">(${business.google_review_count || 0} reviews)</span>
          </div>
          ` : '<div class="mb-6 text-gray-500">No reviews yet</div>'}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 class="text-2xl font-bold mb-4">About</h2>
              <p class="text-gray-700 mb-6">${business.description || 'No description available.'}</p>

              <h2 class="text-2xl font-bold mb-4">Contact Information</h2>
              <div class="space-y-3">
                ${business.phone ? `
                  <div class="flex items-center">
                    <span class="font-semibold text-gray-700 w-24">Phone:</span>
                    <a href="tel:${business.phone}" class="text-[#ED5409]">${business.phone}</a>
                  </div>
                ` : ''}
                ${business.email ? `
                  <div class="flex items-center">
                    <span class="font-semibold text-gray-700 w-24">Email:</span>
                    <a href="mailto:${business.email}" class="text-[#ED5409]">${business.email}</a>
                  </div>
                ` : ''}
                ${business.website ? `
                  <div class="flex items-center">
                    <span class="font-semibold text-gray-700 w-24">Website:</span>
                    <a href="${business.website}" target="_blank" class="text-[#ED5409]">Visit Website →</a>
                  </div>
                ` : ''}
              </div>
            </div>

            <div>
              <h2 class="text-2xl font-bold mb-4">Location</h2>
              <div class="bg-gray-50 p-4 rounded-lg mb-4">
                ${business.address_line1 ? `<p>${business.address_line1}</p>` : ''}
                ${business.address_line2 ? `<p>${business.address_line2}</p>` : ''}
                <p>${business.city}, ${business.state} ${business.zip_code || ''}</p>
              </div>

              <!-- Google Maps Embed -->
              <div class="w-full h-64 rounded-lg overflow-hidden shadow-lg mb-4">
                <iframe
                  width="100%"
                  height="100%"
                  frameborder="0"
                  style="border:0"
                  referrerpolicy="no-referrer-when-downgrade"
                  src="https://maps.google.com/maps?q=${encodeURIComponent(business.address_line1 ? business.address_line1 + ', ' : '')}${encodeURIComponent(business.city)},+${encodeURIComponent(business.state)}&output=embed"
                  allowfullscreen>
                </iframe>
              </div>

              ${business.facebook_url || business.google_business_url ? `
                <h2 class="text-2xl font-bold mt-6 mb-4">Find Us Online</h2>
                <div class="flex flex-col gap-2">
                  ${business.google_business_url ? `
                    <a href="${business.google_business_url}" target="_blank" class="flex items-center gap-2 text-[#ED5409] hover:text-[#d64808] font-semibold">
                      <span>📍</span> View on Google Maps →
                    </a>
                  ` : ''}
                  ${business.facebook_url ? `
                    <a href="${business.facebook_url}" target="_blank" class="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold">
                      <span>👥</span> Facebook Page →
                    </a>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>

          ${await renderBusinessImageCarousel(business, env)}

          ${await renderFacebookPosts(business.id, db, env)}

          <!-- Claim Listing -->
          <div class="mt-12 rounded-xl border-2 border-[#ED5409]/30 bg-[#fff8ef] p-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">Is this your business?</h2>
            <p class="text-gray-700 mb-6">Claim this listing to request verified ownership and update your public business information. There is no charge to submit a claim.</p>
            <form id="claimForm-${business.id}" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="hidden" name="business_id" value="${business.id}">
              <div>
                <label class="block font-semibold text-gray-800 mb-2">Your name *</label>
                <input name="name" required maxlength="120" class="w-full rounded-lg border border-gray-300 px-4 py-3">
              </div>
              <div>
                <label class="block font-semibold text-gray-800 mb-2">Business email *</label>
                <input name="email" type="email" required maxlength="255" class="w-full rounded-lg border border-gray-300 px-4 py-3">
              </div>
              <div>
                <label class="block font-semibold text-gray-800 mb-2">Phone</label>
                <input name="phone" type="tel" maxlength="30" class="w-full rounded-lg border border-gray-300 px-4 py-3">
              </div>
              <div class="flex items-end">
                <button type="submit" class="w-full rounded-lg bg-[#ED5409] px-5 py-3 font-bold text-white">Request ownership</button>
              </div>
              <p id="claimMessage-${business.id}" class="md:col-span-2 text-sm text-gray-700" role="status"></p>
            </form>
            <script>
              (() => {
                const form = document.getElementById('claimForm-${business.id}');
                const message = document.getElementById('claimMessage-${business.id}');
                if (!form || !message) return;
                form.addEventListener('submit', async (event) => {
                  event.preventDefault();
                  const button = form.querySelector('button[type="submit"]');
                  if (button) { button.disabled = true; button.textContent = 'Submitting...'; }
                  try {
                    const response = await fetch('/api/businesses/${business.id}/claim', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(Object.fromEntries(new FormData(form)))
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Claim request failed');
                    message.textContent = result.message;
                    message.className = 'md:col-span-2 text-sm text-green-700';
                    form.reset();
                  } catch (error) {
                    message.textContent = error instanceof Error ? error.message : 'Claim request failed. Please try again.';
                    message.className = 'md:col-span-2 text-sm text-red-700';
                    if (button) { button.disabled = false; button.textContent = 'Request ownership'; }
                  }
                });
              })();
            </script>
          </div>

          <!-- Contact Lead Form -->
          <div class="mt-12 bg-gradient-to-br from-[#FFCB67] to-[#FFA59D] rounded-xl p-8">
            <h2 class="text-3xl font-bold text-white mb-2">Get in Touch</h2>
            <p class="text-white/90 mb-6">Interested in ${business.name}? Send them a message and they'll get back to you soon.</p>

            <form id="contactForm" class="space-y-4">
              <input type="hidden" name="business_id" value="${business.id}">

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-white font-semibold mb-2">Your Name *</label>
                  <input type="text" name="name" required
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2">Email *</label>
                  <input type="email" name="email" required
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-white font-semibold mb-2">Phone</label>
                  <input type="tel" name="phone"
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2">Service Needed</label>
                  <input type="text" name="service_requested" placeholder="e.g., Haircut, Repair, Consultation"
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-white font-semibold mb-2">When do you need this?</label>
                  <select name="urgency"
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                    <option value="asap">ASAP</option>
                    <option value="this-week">This Week</option>
                    <option value="this-month" selected>This Month</option>
                    <option value="browsing">Just Browsing</option>
                  </select>
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2">Preferred Contact Method</label>
                  <select name="preferred_contact_method"
                    class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50">
                    <option value="email" selected>Email</option>
                    <option value="phone">Phone Call</option>
                    <option value="sms">Text Message</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-white font-semibold mb-2">Message</label>
                <textarea name="message" rows="4"
                  placeholder="Tell ${business.name} about your needs..."
                  class="w-full px-4 py-3 rounded-lg border-2 border-white/20 focus:border-white focus:ring-2 focus:ring-white/50"></textarea>
              </div>

              <button type="submit"
                class="w-full bg-white text-[#ED5409] font-bold py-4 px-8 rounded-lg hover:bg-gray-100 transition-colors">
                Send Message
              </button>

              <div id="formMessage" class="hidden mt-4 p-4 rounded-lg"></div>
            </form>

            <script>
              document.getElementById('contactForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const formData = new FormData(form);
                const submitBtn = form.querySelector('button[type="submit"]');
                const messageDiv = document.getElementById('formMessage');

                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';

                try {
                  const response = await fetch('/api/lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(formData))
                  });

                  const data = await response.json();

                  if (response.ok) {
                    messageDiv.className = 'mt-4 p-4 rounded-lg bg-green-100 text-green-800';
                    messageDiv.textContent = 'Message sent successfully! ${business.name} will be in touch soon.';
                    messageDiv.classList.remove('hidden');
                    form.reset();
                  } else {
                    throw new Error(data.error || 'Failed to send message');
                  }
                } catch (error) {
                  messageDiv.className = 'mt-4 p-4 rounded-lg bg-red-100 text-red-800';
                  messageDiv.textContent = error.message || 'Failed to send message. Please try again.';
                  messageDiv.classList.remove('hidden');
                } finally {
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Send Message';
                }
              });
            </script>
          </div>

        </div>
      </div>
    </div>
  `;

  // Build SEO meta description and JSON-LD structured data
  const metaDescription = (business.description && business.description.length > 20)
    ? business.description.substring(0, 160)
    : `${business.name} in ${business.city}, ${business.state} - Find contact info, reviews, and more.`;

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    image: business.image_url || (business.facebook_url ? (business as any).facebook_image_url : undefined),
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address_line1 || undefined,
      addressLocality: business.city || undefined,
      addressRegion: business.state || undefined,
      postalCode: business.zip_code || undefined
    },
    url: business.website || undefined,
    sameAs: [business.facebook_url || '', business.google_business_url || ''].filter(Boolean),
    aggregateRating: business.google_review_count ? {
      "@type": "AggregateRating",
      ratingValue: business.google_rating?.toFixed(1),
      reviewCount: business.google_review_count
    } : undefined,
    description: business.description || undefined
  };

  const extraHead = `
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `;

  const html = htmlTemplate(business.name, content, env, extraHead);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

function escapeHtml(s: string){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Submit business form
async function handleSubmitForm(db: DatabaseService, env: Env): Promise<Response> {
  const categories = await db.getAllCategories();

  const content = `
    <div class="container mx-auto px-4 py-12 max-w-2xl">
      <h1 class="text-4xl font-bold text-center mb-8">List Your Business</h1>

      <div class="bg-white rounded-xl shadow-xl p-8">
        <!-- Facebook Auto-Fill Section -->
        <div id="fbAutoFillSection" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 class="font-semibold text-blue-900 mb-2">Quick Auto-Fill from Facebook</h3>
          <p class="text-sm text-blue-700 mb-3">Connect your Facebook business page to automatically fill in your business information.</p>
          <button type="button" id="fbLoginBtn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Connect Facebook Page
          </button>

          <div id="fbPageSelector" class="mt-4 hidden">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Select Your Business Page</label>
            <select id="fbPageSelect" class="w-full px-4 py-3 border rounded-lg">
              <option value="">Choose a page...</option>
            </select>
            <button type="button" id="fbAutoFillBtn" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold">
              Auto-Fill From Selected Page
            </button>
          </div>

          <div id="fbMessage" class="mt-3 text-sm hidden"></div>
        </div>

        <form method="POST" action="/submit" class="space-y-6" id="businessForm">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Business Name *</label>
            <input type="text" name="name" required class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409] focus:border-transparent">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
            <select name="category_id" required class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
              <option value="">Select a category</option>
              ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea name="description" rows="4" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]"></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Email or Facebook Profile *</label>
              <input type="text" name="email_or_facebook" required
                placeholder="email@business.com or facebook.com/yourpage"
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
              <p class="text-xs text-gray-600 mt-1">Provide either email or Facebook page URL</p>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <input type="tel" name="phone" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Website</label>
            <input type="url" name="website" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Address</label>
            <input type="text" name="address" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Address Line 2</label>
            <input type="text" name="address_line2" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">ZIP Code</label>
              <input type="text" name="zip_code" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Service Area (comma-separated)</label>
              <input type="text" name="service_area" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Latitude</label>
              <input type="number" step="any" name="latitude" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Longitude</label>
              <input type="number" step="any" name="longitude" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Facebook Page URL (optional)</label>
            <input type="url" name="facebook_url" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Google Business URL (optional)</label>
            <input type="url" name="google_business_url" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
          </div>


          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">City *</label>
              <input type="text" name="city" required class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">State *</label>
              <select name="state" required class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
                <option value="OK">Oklahoma</option>
                <option value="TX">Texas</option>
                <option value="AR">Arkansas</option>
              </select>
            </div>
          </div>

          <button type="submit" class="w-full bg-[#ED5409] text-white py-4 rounded-lg font-semibold text-lg hover:bg-[#d64808]">
            Submit Business
          </button>
        </form>
      </div>
    </div>

    <script>
      // Facebook Auto-Fill functionality
      (function() {
        const fbLoginBtn = document.getElementById('fbLoginBtn');
        const fbPageSelector = document.getElementById('fbPageSelector');
        const fbPageSelect = document.getElementById('fbPageSelect');
        const fbAutoFillBtn = document.getElementById('fbAutoFillBtn');
        const fbMessage = document.getElementById('fbMessage');
        const form = document.getElementById('businessForm');

        let fbPages = [];

        // Check if returning from Facebook OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const connected = urlParams.get('fb_connected');
        const pagesCount = urlParams.get('fb_pages');
        const fbError = urlParams.get('fb_error');

        if (fbError) {
          showMessage('Facebook login failed: ' + fbError, 'error');
        }

        if (connected === '1' && pagesCount) {
          loadFacebookPages();
        }

        if (connected || fbError) {
          window.history.replaceState({}, document.title, '/submit');
        }

        // Facebook Login Button Click
        fbLoginBtn.addEventListener('click', function() {
          window.location.href = '/auth/facebook';
        });

        // Auto-Fill Button Click
        fbAutoFillBtn.addEventListener('click', async function() {
          const pageId = fbPageSelect.value;
          if (!pageId) {
            showMessage('Please select a page first', 'error');
            return;
          }

          try {
            showMessage('Loading page information...', 'info');

            const response = await fetch('/auth/facebook/page-info', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ page_id: pageId })
            });
            if (!response.ok) throw new Error('Failed to load page info');

            const data = await response.json();
            const pageInfo = data.pageInfo;

            // Auto-fill form fields
            if (pageInfo.name) form.querySelector('[name="name"]').value = pageInfo.name;
            if (pageInfo.about) form.querySelector('[name="description"]').value = pageInfo.about;
            if (pageInfo.phone) form.querySelector('[name="phone"]').value = pageInfo.phone;
            if (pageInfo.website) form.querySelector('[name="website"]').value = pageInfo.website;
            if (pageInfo.emails && pageInfo.emails.length > 0) {
              form.querySelector('[name="email_or_facebook"]').value = pageInfo.emails[0];
            }
            if (pageInfo.location) {
              const loc = pageInfo.location;
              if (loc.street) form.querySelector('[name="address"]').value = loc.street;
              if (loc.city) form.querySelector('[name="city"]').value = loc.city;
              if (loc.state) form.querySelector('[name="state"]').value = loc.state;
              if (loc.zip) form.querySelector('[name="zip_code"]').value = loc.zip;
              if (loc.latitude) form.querySelector('[name="latitude"]').value = loc.latitude;
              if (loc.longitude) form.querySelector('[name="longitude"]').value = loc.longitude;
            }

            // Set Facebook URL
            form.querySelector('[name="facebook_url"]').value = 'https://facebook.com/' + pageId;

            showMessage('✓ Form auto-filled successfully! Review and submit.', 'success');

          } catch (error) {
            console.error('Auto-fill error:', error);
            showMessage('Failed to auto-fill: ' + error.message, 'error');
          }
        });

        // Load user's Facebook pages
        async function loadFacebookPages() {
          try {
            const response = await fetch('/auth/facebook/pages', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Failed to load pages');

            const data = await response.json();
            fbPages = data.pages;

            if (fbPages.length === 0) {
              showMessage('No Facebook pages found. Make sure you manage at least one business page.', 'error');
              return;
            }

            // Populate page selector
            fbPageSelect.innerHTML = '<option value="">Choose a page...</option>';
            fbPages.forEach(page => {
              const option = document.createElement('option');
              option.value = page.id;
              option.textContent = page.name + (page.category ? ' (' + page.category + ')' : '');
              fbPageSelect.appendChild(option);
            });

            fbPageSelector.classList.remove('hidden');
            showMessage('✓ Connected! Select your business page below.', 'success');

          } catch (error) {
            console.error('Page loading error:', error);
            showMessage('Failed to load your pages: ' + error.message, 'error');
          }
        }

        function showMessage(msg, type) {
          fbMessage.textContent = msg;
          fbMessage.classList.remove('hidden', 'text-blue-700', 'text-green-700', 'text-red-700');
          if (type === 'success') fbMessage.classList.add('text-green-700');
          else if (type === 'error') fbMessage.classList.add('text-red-700');
          else fbMessage.classList.add('text-blue-700');
        }
      })();
    </script>
  `;

  const html = htmlTemplate('List Your Business', content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Handle business submission
async function handleSubmitBusiness(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const formData = await request.formData();

  // Basic validation
  const name = formData.get('name')?.toString().trim();
  const emailOrFacebook = formData.get('email_or_facebook')?.toString().trim();
  const city = formData.get('city')?.toString().trim();
  const state = formData.get('state')?.toString().trim();
  const category_id = formData.get('category_id')?.toString();

  // Required field validation
  if (!name || name.length < 2 || name.length > 200) {
    return new Response('Invalid business name (2-200 characters required)', { status: 400 });
  }

  // Validate email or Facebook URL
  if (!emailOrFacebook || emailOrFacebook.length < 5) {
    return new Response('Email or Facebook profile URL required', { status: 400 });
  }

  // Determine if it's email or Facebook URL
  let email = null;
  let facebook_url = null;
  if (emailOrFacebook.includes('@')) {
    // It's an email
    if (!emailOrFacebook.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return new Response('Invalid email address format', { status: 400 });
    }
    email = emailOrFacebook;
  } else if (emailOrFacebook.includes('facebook.com') || emailOrFacebook.includes('fb.com')) {
    // It's a Facebook URL
    facebook_url = emailOrFacebook.startsWith('http') ? emailOrFacebook : `https://${emailOrFacebook}`;
  } else {
    return new Response('Please provide a valid email or Facebook page URL', { status: 400 });
  }

  if (!city || city.length < 2 || city.length > 100) {
    return new Response('Valid city name required', { status: 400 });
  }

  if (!state || !['OK', 'TX', 'AR'].includes(state)) {
    return new Response('Valid state required (OK, TX, or AR)', { status: 400 });
  }

  if (!category_id || isNaN(parseInt(category_id))) {
    return new Response('Valid category required', { status: 400 });
  }

  const facebookConnection = await getFacebookSubmitSession(request, env);
  const connectedFacebookPage = facebookConnection?.session.selectedPage;

  // Optional field sanitization
  const phone = formData.get('phone')?.toString().trim() || null;
  const description = formData.get('description')?.toString().trim().substring(0, 2000) || null;
  const address = formData.get('address')?.toString().trim().substring(0, 200) || null;
  const address_line2 = formData.get('address_line2')?.toString().trim().substring(0,200) || null;
  const zip_code = formData.get('zip_code')?.toString().trim() || null;
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null;
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null;
  const service_area = formData.get('service_area')?.toString().trim() || null;
  const facebook_url_explicit = formData.get('facebook_url')?.toString().trim() || null;
  const google_business_url = formData.get('google_business_url')?.toString().trim() || null;
  const website = formData.get('website')?.toString().trim().substring(0, 300) || null;

  const submission = {
    name,
    email,
    facebook_url: connectedFacebookPage
      ? `https://facebook.com/${connectedFacebookPage.id}`
      : facebook_url_explicit || facebook_url,
    phone,
    category_id: parseInt(category_id),
    description,
    address,
    address_line2,
    zip_code,
    latitude,
    longitude,
    service_area,
    city,
    state,
    website,
    google_business_url,
    google_rating: null,
    google_review_count: null,
    facebook_rating: connectedFacebookPage?.overall_star_rating ?? null,
    facebook_review_count: connectedFacebookPage?.rating_count ?? null,
    is_verified: false,
    facebook_connection: connectedFacebookPage && facebookConnection ? {
      source: 'meta_oauth_managed_page',
      page_id: connectedFacebookPage.id,
      page_name: connectedFacebookPage.name,
      connected_at: new Date(facebookConnection.session.createdAt).toISOString()
    } : null
  };

  // Log a minimal submission summary for observability (avoid logging full PII)
  try {
    console.info('Creating business submission', {
      name: name && name.length ? name.substring(0, 100) : null,
      city,
      state,
      category_id: submission.category_id,
      email_provided: !!email,
      facebook_provided: !!submission.facebook_url
    });

    await db.createBusinessSubmission(submission);
    if (facebookConnection) {
      await env.CACHE.delete(`fb_submit_session:${facebookConnection.id}`);
    }
  } catch (error) {
    console.error('DB error creating business submission:', error);
    return new Response('Failed to save submission', { status: 500 });
  }

  // Redirect to success page
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/?submitted=true',
      'Set-Cookie': `${FACEBOOK_SUBMIT_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}

// Categories list
async function handleCategoriesList(db: DatabaseService, env: Env): Promise<Response> {
  const categories = await db.getAllCategories();

  const content = `
    <div class="container mx-auto px-4 py-12">
      <h1 class="text-4xl font-bold text-center mb-12">Browse All Categories</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${categories.map(cat => `
          <a href="/category/${cat.slug}" class="card-hover bg-white rounded-xl shadow-lg p-6 flex items-center space-x-4">
            <div class="text-5xl">${cat.icon || '📁'}</div>
            <div>
              <h3 class="text-xl font-bold text-gray-800">${cat.name}</h3>
              <p class="text-gray-600 text-sm">${cat.description || ''}</p>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;

  const html = htmlTemplate('All Categories', content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Blog handler
async function handleBlog(db: DatabaseService, env: Env): Promise<Response> {
  const posts = await db.getRecentBlogPosts(20);

  const content = `
    <div class="container mx-auto px-4 py-12">
      <h1 class="text-4xl font-bold text-center mb-12 text-primary">Business Spotlights & News</h1>

      ${posts.length === 0 ? `
        <div class="text-center text-secondary py-12">
          <p class="text-xl">No blog posts yet. Check back soon!</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${posts.map(post => `
            <a href="/blog/${post.slug}" class="glow-card block cursor-pointer group">
              <div class="h-48 bg-gradient-to-br from-[#214E81] to-[#ED5409] relative overflow-hidden">
                ${post.featured_image ? `
                  <img src="${post.featured_image}" alt="${post.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                ` : ''}
              </div>
              <div class="p-6">
                <h3 class="text-xl font-bold mb-2 text-primary group-hover:text-[#FFCB67] transition-colors">${post.title}</h3>
                <p class="text-secondary mb-4 line-clamp-3">${post.excerpt || ''}</p>
                <span class="sonic-orange font-semibold group-hover:text-[#FFCB67] transition-colors inline-flex items-center gap-2">
                  Read More
                  <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </span>
              </div>
            </a>
          `).join('')}
        </div>
      `}
    </div>
  `;

  const html = htmlTemplate('Blog', content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Individual blog post handler
async function handleBlogPost(slug: string, db: DatabaseService, env: Env): Promise<Response> {
  const post = await db.getBlogPostBySlug(slug);

  if (!post) {
    return new Response('Blog post not found', { status: 404 });
  }

  // Allow viewing unpublished posts in development (you can remove this in production)
  // if (!post.is_published) {
  //   return new Response('Blog post not found', { status: 404 });
  // }

  // Enhanced markdown to HTML conversion
  let contentHtml = post.content
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-3 text-primary">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4 text-primary">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-10 mb-5 text-primary">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="sonic-orange hover:text-[#FFCB67] underline transition-colors">$1</a>')
    .split('\n\n')
    .map(para => {
      if (para.trim().startsWith('<h') || para.trim().startsWith('<li')) {
        return para;
      }
      if (para.trim().startsWith('- ')) {
        const items = para.split('\n').filter(line => line.trim().startsWith('- '));
        return '<ul class="list-disc ml-6 mb-4 space-y-2">' +
          items.map(item => '<li class="text-gray-300">' + item.substring(2) + '</li>').join('') +
          '</ul>';
      }
      return para.trim() ? '<p class="mb-4 text-gray-300 leading-relaxed">' + para + '</p>' : '';
    })
    .join('');

  const publishDate = new Date(post.publish_date * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let sidebarPlacements: any[] = [];
  let localAuction: any = null;
  let regionalAuction: any = null;
  try {
    [sidebarPlacements, localAuction, regionalAuction] = await Promise.all([
      db.getActiveAdPlacements('sidebar'),
      getAuctionStatus(env.DB, 'local-spotlight'),
      getAuctionStatus(env.DB, 'regional-spotlight')
    ]);
  } catch (error) {
    console.warn('Blog sidebar ads unavailable; using fallback inventory cards', error);
  }

  const sidebarAd = (placement: any, sticky = false) => `
    <a href="/business/${placement.slug}" class="glow-card block p-6 ${sticky ? 'sticky top-24' : ''}" aria-label="Sponsored: ${placement.name}">
      <div class="rounded-lg overflow-hidden mb-4 h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        ${placement.image_url ? `<img src="${placement.image_url}" alt="${placement.name}" class="w-full h-full object-cover">` : placement.facebook_image_url ? `<img src="${placement.facebook_image_url}" alt="${placement.name}" class="w-full h-full object-cover">` : `<span class="text-5xl">🏪</span>`}
      </div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold uppercase tracking-widest text-[#ED5409]">${placement.sponsored_label || 'Sponsored'}</span>
        <span class="text-xs text-secondary">Live placement</span>
      </div>
      <h3 class="text-xl font-bold text-primary">${placement.name}</h3>
      <p class="text-secondary text-sm mt-1">${placement.city}, ${placement.state}</p>
      ${placement.description ? `<p class="text-gray-300 mt-3 line-clamp-3">${placement.description}</p>` : ''}
      <span class="inline-block mt-4 sonic-orange font-semibold">View sponsor →</span>
    </a>`;

  const auctionFallback = (title: string, status: any, sticky = false) => {
    const current = status || { tier: { label: title, placement_type: 'sidebar', floor_cents: title === 'Regional Spotlight' ? 2500 : 500 }, openingBidCents: title === 'Regional Spotlight' ? 2500 : 500, currentBidCents: title === 'Regional Spotlight' ? 2500 : 500, paymentStatus: 'pending-square', currentBusinessId: null };
    return `
      <div class="glow-card p-6 ${sticky ? 'sticky top-24' : ''}">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-widest text-[#ED5409]">Auction inventory</span>
          <span class="text-xs text-secondary">${current.paymentStatus}</span>
        </div>
        <h3 class="text-xl font-bold text-primary mb-2">${current.tier.label}</h3>
        <p class="text-gray-300 mb-4">Live sponsored placement is available through the auction. Square payment verification keeps the slot pending until confirmed.</p>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="rounded-xl bg-black/20 border border-white/5 p-4">
            <div class="text-xs uppercase tracking-widest text-secondary">Floor</div>
            <div class="text-2xl font-bold mt-1 text-[#FFCB67]">$${(current.tier.floor_cents / 100).toFixed(2)}</div>
          </div>
          <div class="rounded-xl bg-black/20 border border-white/5 p-4">
            <div class="text-xs uppercase tracking-widest text-secondary">Current</div>
            <div class="text-2xl font-bold mt-1 text-[#FFCB67]">$${(current.currentBidCents / 100).toFixed(2)}</div>
          </div>
        </div>
        <div class="text-sm text-gray-400 mb-4">${current.currentBusinessId ? 'This slot is occupied' : 'No current winner yet'}</div>
        <div class="flex gap-3 flex-wrap">
          <a href="/advertise" class="btn-glow text-white px-5 py-3 rounded-lg font-semibold inline-block">Advertise</a>
          <a href="/pricing" class="border border-[#ED5409]/50 text-[#FFCB67] px-5 py-3 rounded-lg font-semibold inline-block hover:bg-[#ED5409]/10 transition-colors">Pricing</a>
        </div>
      </div>`;
  };

  const content = `
    <div class="container mx-auto px-4 py-12">
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

          <!-- Main Content Area -->
          <article class="lg:col-span-8">
            <div class="glow-card p-8 mb-8">
              ${post.featured_image ? `
                <div class="mb-8 rounded-lg overflow-hidden">
                  <img src="${post.featured_image}" alt="${post.title}" class="w-full h-96 object-cover">
                </div>
              ` : ''}

              <h1 class="text-4xl font-bold mb-4 text-primary leading-tight">${post.title}</h1>

              <div class="flex items-center gap-4 mb-8 text-sm text-secondary border-b border-gray-700 pb-6">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                  </svg>
                  ${post.author || 'KiamichiBizConnect'}
                </span>
                <span>•</span>
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/>
                  </svg>
                  ${publishDate}
                </span>
              </div>

              ${post.excerpt ? `
                <div class="bg-gradient-to-r from-[#ED5409]/10 to-[#FFCB67]/10 border-l-4 border-[#ED5409] p-6 mb-8 rounded-r-lg">
                  <p class="text-xl text-gray-200 italic leading-relaxed">${post.excerpt}</p>
                </div>
              ` : ''}

              <div class="prose prose-invert max-w-none text-lg leading-relaxed">
                ${contentHtml}
              </div>

              <div class="mt-12 pt-8 border-t border-gray-700 flex items-center justify-between">
                <a href="/blog" class="sonic-orange font-semibold hover:text-[#FFCB67] transition-colors flex items-center gap-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                  </svg>
                  Back to All Posts
                </a>

                <div class="flex items-center gap-4">
                  <span class="text-secondary text-sm">Share:</span>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${env.SITE_URL}/blog/${post.slug}" target="_blank" class="text-gray-400 hover:text-[#FFCB67] transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                  <a href="https://twitter.com/intent/tweet?url=${env.SITE_URL}/blog/${post.slug}&text=${encodeURIComponent(post.title)}" target="_blank" class="text-gray-400 hover:text-[#FFCB67] transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <!-- Related Posts / CTA -->
            <div class="glow-card p-8">
              <h3 class="text-2xl font-bold mb-4 text-primary">Grow Your Business</h3>
              <p class="text-gray-300 mb-6">Want to get featured on KiamichiBizConnect and reach thousands of local customers?</p>
              <a href="/submit" class="btn-glow text-white px-6 py-3 rounded-lg font-semibold inline-block">
                List Your Business Today
              </a>
            </div>
          </article>

          <!-- Sidebar with Sponsored Placements -->
          <aside class="lg:col-span-4 space-y-6">
            ${sidebarPlacements[0] ? sidebarAd(sidebarPlacements[0]) : auctionFallback('Local Spotlight', localAuction)}

            <!-- Popular Posts -->
            <div class="glow-card p-6">
              <h3 class="text-xl font-bold mb-4 text-primary">Popular Posts</h3>
              <div class="space-y-4">
                <a href="/blog" class="block group">
                  <div class="flex gap-3">
                    <div class="w-20 h-20 bg-gradient-to-br from-[#ED5409] to-[#FFCB67] rounded-lg flex-shrink-0"></div>
                    <div>
                      <h4 class="text-sm font-semibold text-primary group-hover:text-[#FFCB67] transition-colors line-clamp-2">More Business Spotlights Coming Soon</h4>
                      <p class="text-xs text-secondary mt-1">Recent</p>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            <div class="glow-card p-6">
              <h3 class="text-xl font-bold mb-4 text-primary">Browse Categories</h3>
              <div class="space-y-2">
                <a href="/categories" class="block text-gray-300 hover:text-[#FFCB67] transition-colors">All Categories →</a>
              </div>
            </div>

            ${sidebarPlacements[1] ? sidebarAd(sidebarPlacements[1]) : auctionFallback('Regional Spotlight', regionalAuction)}
            ${sidebarPlacements[2] ? sidebarAd(sidebarPlacements[2], true) : auctionFallback('Regional Spotlight', regionalAuction, true)}
          </aside>
        </div>
      </div>
    </div>
  `;

  const html = htmlTemplate(post.title, content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function isAuctionAdsEnabled(env: Env): Promise<boolean> {
  try {
    return await env.FLAGS.getBooleanValue('enable-auction-ads', true);
  } catch (error) {
    console.warn('Flagship evaluation failed for enable-auction-ads; defaulting to enabled', error);
    return true;
  }
}

async function getAuctionAdsFlagState(env: Env): Promise<Record<string, unknown>> {
  try {
    const details = await (env.FLAGS as any).getBooleanDetails?.('enable-auction-ads', true);
    if (details) {
      return {
        key: 'enable-auction-ads',
        value: details.value,
        variant: details.variant ?? null,
        reason: details.reason ?? null
      };
    }

    return {
      key: 'enable-auction-ads',
      value: await env.FLAGS.getBooleanValue('enable-auction-ads', true),
      variant: null,
      reason: 'VALUE_ONLY'
    };
  } catch (error) {
    return {
      key: 'enable-auction-ads',
      value: true,
      variant: null,
      reason: 'FALLBACK_ENABLED',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// API handler (for future AJAX endpoints)
async function handleAPI(path: string, request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if ((path.startsWith('/api/auctions/') || path === '/api/webhooks/square') && !(await isAuctionAdsEnabled(env))) {
    return Response.json({ error: 'Auction ads are temporarily unavailable' }, { status: 503 });
  }

  // Public read-only auction status. Bid activation remains disabled until
  // Square payment verification is wired through the server-side webhook.
  const auctionMatch = path.match(/^\/api\/auctions\/([a-z0-9-]+)\/status$/);
  if (auctionMatch && request.method === 'GET') {
    const status = await getAuctionStatus(env.DB, auctionMatch[1]);
    if (!status) return Response.json({ error: 'Auction tier not found' }, { status: 404 });
    return Response.json(status, {
      headers: { 'Cache-Control': 'public, max-age=30' }
    });
  }

  const bidMatch = path.match(/^\/api\/auctions\/([a-z0-9-]+)\/bids$/);
  if (bidMatch && request.method === 'POST') {
    try {
      if (!isSquareCheckoutConfigured(env)) {
        return Response.json({ error: 'Auction checkout is not configured yet. Please try again after Square setup is complete.' }, { status: 503 });
      }
      const data = await request.json() as { business_name?: unknown; contact_email?: unknown; business_location?: unknown; bid_cents?: unknown; bidCents?: unknown };
      const businessName = typeof data.business_name === 'string' ? data.business_name.trim().slice(0, 160) : '';
      const contactEmail = typeof data.contact_email === 'string' ? data.contact_email.trim().toLowerCase().slice(0, 255) : '';
      const businessLocation = typeof data.business_location === 'string' ? data.business_location.trim().slice(0, 160) : '';
      const bidCents = Number(data.bid_cents ?? data.bidCents);
      if (!businessName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !Number.isInteger(bidCents) || bidCents <= 0) {
        return Response.json({ error: 'business_name, contact_email, and bid_cents are required' }, { status: 400 });
      }

      let business = await env.DB.prepare(`
        SELECT id, name FROM businesses
        WHERE is_active = 1 AND lower(name) = lower(?)
        LIMIT 1
      `).bind(businessName).first<{ id: number; name: string }>();

      if (!business) {
        const category = await env.DB.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').first<{ id: number }>();
        if (!category) return Response.json({ error: 'Business categories are not configured yet' }, { status: 503 });
        const locationParts = businessLocation.split(',').map((part) => part.trim()).filter(Boolean);
        const city = locationParts[0] || 'Regional';
        const state = locationParts[1] || 'OK';
        const slug = `advertiser-${crypto.randomUUID().slice(0, 12)}`;
        const inserted = await env.DB.prepare(`
          INSERT INTO businesses (name, slug, description, category_id, city, state, is_verified, is_featured, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
        `).bind(businessName, slug, 'Advertiser-only business record pending profile completion.', category.id, city, state).run();
        business = { id: Number(inserted.meta.last_row_id || 0), name: businessName };
      }

      if (!business.id) return Response.json({ error: 'Could not create advertiser record' }, { status: 500 });
      await env.DB.prepare(`
        INSERT INTO advertiser_accounts (business_id, status, plan, contact_email, advertised_name)
        VALUES (?, 'pending', 'auction-only', ?, ?)
        ON CONFLICT(business_id) DO UPDATE SET contact_email = excluded.contact_email, advertised_name = excluded.advertised_name, updated_at = unixepoch()
      `).bind(business.id, contactEmail, businessName).run();

      const result = await createSponsoredAuctionBid(db, env, {
        tierId: bidMatch[1],
        businessId: business.id,
        bidCents
      });
      return Response.json(result.body, { status: result.status });
    } catch (error) {
      console.error('Auction bid creation failed:', error);
      return Response.json({ error: 'Failed to create auction bid' }, { status: 500 });
    }
  }

  if (path === '/api/webhooks/square' && request.method === 'POST') {
    return handleSquareWebhook(db, env, request);
  }

  const claimMatch = path.match(/^\/api\/businesses\/(\d+)\/claim$/);
  if (claimMatch && request.method === 'POST') {
    try {
      const data = await request.json() as { name?: unknown; email?: unknown; phone?: unknown };
      const businessId = Number(claimMatch[1]);
      const name = typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '';
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase().slice(0, 255) : '';
      const phone = typeof data.phone === 'string' ? data.phone.trim().slice(0, 30) : null;
      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'A valid name and business email are required' }, { status: 400 });
      }
      const business = await db.getBusinessById(businessId);
      if (!business) return Response.json({ error: 'Business listing not found' }, { status: 404 });
      const existing = await env.DB.prepare(`
        SELECT id FROM business_claim_requests
        WHERE business_id = ? AND requester_email = ? AND status = 'pending'
        LIMIT 1
      `).bind(businessId, email).first<{ id: number }>();
      if (existing) return Response.json({ message: 'A claim request for this listing is already pending review.' });
      await env.DB.prepare(`
        INSERT INTO business_claim_requests (
          business_id, requester_name, requester_email, requester_phone, status, verification_method
        ) VALUES (?, ?, ?, ?, 'pending', 'manual_review')
      `).bind(businessId, name, email, phone).run();
      return Response.json({ message: 'Claim request received. We will review the business information and contact you for verification.' }, { status: 201 });
    } catch (error) {
      console.error('Business claim request failed:', error);
      return Response.json({ error: 'Unable to submit claim request' }, { status: 500 });
    }
  }

  // API: Get categories
  if (path === '/api/categories') {
    const categories = await db.getAllCategories();
    return Response.json(categories);
  }

  // API: Search businesses
  if (path === '/api/search') {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const results = await db.searchBusinesses({ query, category });
    return Response.json(results);
  }

  // API: AI Search (natural language)
  if (path === '/api/ai-search') {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    if (!query) {
      return Response.json({ error: 'Query parameter required' }, { status: 400 });
    }

    try {
      // Call NLWeb AI Search worker
      const nlwebResponse = await fetch('https://purple-snow-f107-nlweb.srvcflo.workers.dev/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!nlwebResponse.ok) {
        throw new Error(`NLWeb returned ${nlwebResponse.status}`);
      }

      const text = await nlwebResponse.text();
      let results: any[] = [];

      // Parse streaming response to extract results
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.message_type === 'result_batch' && data.results) {
              results = data.results;
              break;
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }

      return Response.json({
        query,
        results: results.slice(0, 5).map(r => ({
          name: r.name,
          url: r.url,
          description: r.description?.substring(0, 200),
          score: r.score
        })),
        total: results.length
      });
    } catch (error: any) {
      console.error('AI Search API error:', error);
      return Response.json({
        error: 'AI Search failed',
        message: error.message
      }, { status: 500 });
    }
  }

  // API: Get stats
  if (path === '/api/stats') {
    const stats = await db.getStats();
    return Response.json(stats);
  }

  // API: Submit contact lead
  if (path === '/api/lead' && request.method === 'POST') {
    try {
      const data = await request.json() as any;

      // Validation
      if (!data.business_id || !data.name || !data.email) {
        return Response.json(
          { error: 'Missing required fields: business_id, name, email' },
          { status: 400 }
        );
      }

      // Validate email format
      if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return Response.json(
          { error: 'Invalid email address' },
          { status: 400 }
        );
      }

      // Create lead
      const leadId = await db.createContactLead({
        business_id: parseInt(data.business_id),
        name: data.name.trim().substring(0, 100),
        email: data.email.trim().toLowerCase().substring(0, 255),
        phone: data.phone ? data.phone.trim().substring(0, 20) : undefined,
        service_requested: data.service_requested ? data.service_requested.trim().substring(0, 200) : undefined,
        message: data.message ? data.message.trim().substring(0, 2000) : undefined,
        urgency: data.urgency || 'medium',
        preferred_contact_method: data.preferred_contact_method || 'email'
      });

      // Check if business has auto-forward enabled
      const subscription = await db.getBusinessLeadSubscription(parseInt(data.business_id));

      // TODO: In future, implement email/SMS notifications here
      // For now, leads just go to admin dashboard for manual forwarding

      return Response.json({
        success: true,
        leadId,
        message: 'Your message has been received and will be forwarded to the business soon.'
      });

    } catch (error) {
      console.error('Error creating lead:', error);
      return Response.json(
        { error: 'Failed to submit message. Please try again.' },
        { status: 500 }
      );
    }
  }

  // API: Facebook auth callback from client-side SDK
  if (path === '/api/facebook/auth' && request.method === 'POST') {
    try {
      const data = await request.json() as any;
      const auth = data?.authResponse;

      if (!auth || !auth.accessToken) {
        return Response.json({ error: 'Missing authResponse.accessToken' }, { status: 400 });
      }

      const accessToken = auth.accessToken;

      // Validate token by requesting the user's profile directly with the provided token
      const graphUrl = `https://graph.facebook.com/me?fields=id,name,email,link,picture` +
        `&access_token=${encodeURIComponent(accessToken)}`;

      const fbRes = await fetch(graphUrl);
      if (!fbRes.ok) {
        const text = await fbRes.text();
        console.error('Facebook Graph API error:', text);
        return Response.json({ error: 'Failed to validate access token with Facebook' }, { status: 400 });
      }

      const profile = await fbRes.json() as any;

      // Try to find an existing business by facebook_url (contains profile.id) or email
      let matchedBusiness: any = null;
      try {
        if (profile.id) {
          const fbLike = `%${profile.id}%`;
          const r = await db.db.prepare('SELECT * FROM businesses WHERE facebook_url LIKE ? LIMIT 1').bind(fbLike).first();
          if (r) matchedBusiness = r;
        }

        if (!matchedBusiness && profile.email) {
          const r2 = await db.db.prepare('SELECT * FROM businesses WHERE LOWER(email) = LOWER(?) LIMIT 1').bind(profile.email).first();
          if (r2) matchedBusiness = r2;
        }
      } catch (e) {
        console.warn('DB lookup error while matching FB profile:', e);
      }

      if (matchedBusiness) {
        // Update business with facebook_url and image if available
        const updates: any = {};
        if (profile.link) updates.facebook_url = profile.link;
        if (profile.picture && profile.picture.data && profile.picture.data.url) updates.image_url = profile.picture.data.url;
        try { await db.updateBusiness(matchedBusiness.id, updates); } catch (e) { console.warn('Failed to update business with FB data', e); }

        return Response.json({ success: true, profile, matchedBusinessId: matchedBusiness.id });
      }

      // No matching business found — create a submission for admin review using the profile data
      const submissionId = await db.createBusinessSubmission({
        name: profile.name || 'Facebook User',
        email: profile.email || '',
        phone: null,
        category_id: null,
        description: `Imported from Facebook profile ${profile.id || ''}`,
        address: null,
        city: null,
        state: null,
        website: profile.link || null,
        submission_data: JSON.stringify({ profile, auth })
      });

      return Response.json({ success: true, profile, submissionId, message: 'Created a submission for admin review' });
    } catch (error) {
      console.error('Error handling /api/facebook/auth:', error);
      return Response.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // API: Trigger business analysis (admin only)
  if (path === '/api/admin/analyze' && request.method === 'POST') {
    try {
      const data = await request.json() as any;

      if (!data.businessId) {
        return Response.json({ error: 'Missing businessId' }, { status: 400 });
      }

      // Call the analyzer worker via service binding
      const analyzerResponse = await env.ANALYZER.fetch('https://analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: data.businessId,
          mode: data.mode || 'manual',
          adminEmail: data.adminEmail
        })
      });

      const result = await analyzerResponse.json();
      return Response.json(result);

    } catch (error) {
      console.error('Error triggering analysis:', error);
      return Response.json({ error: 'Failed to trigger analysis' }, { status: 500 });
    }
  }

  // API: Get analysis results (admin only)
  if (path.match(/^\/api\/admin\/analysis\/\d+$/) && request.method === 'GET') {
    try {
      const businessId = parseInt(path.split('/')[4]);

      // Call the analyzer worker to get results
      const analyzerResponse = await env.ANALYZER.fetch(`https://analyzer/analysis/${businessId}`);

      const result = await analyzerResponse.json();
      return Response.json(result);

    } catch (error) {
      console.error('Error fetching analysis:', error);
      return Response.json({ error: 'Failed to fetch analysis' }, { status: 500 });
    }
  }

  // API: Get enrichment suggestions (admin only)
  if (path.match(/^\/api\/admin\/suggestions\/\d+$/) && request.method === 'GET') {
    try {
      const businessId = parseInt(path.split('/')[4]);

      const suggestions = await env.DB.prepare(`
        SELECT * FROM enrichment_suggestions
        WHERE business_id = ?
        ORDER BY confidence DESC, created_at DESC
      `).bind(businessId).all();

      return Response.json({ suggestions: suggestions.results });

    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return Response.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
    }
  }

  // API: Approve/reject enrichment suggestion (admin only)
  if (path.match(/^\/api\/admin\/suggestions\/\d+\/review$/) && request.method === 'POST') {
    try {
      const suggestionId = parseInt(path.split('/')[4]);
      const data = await request.json() as any;

      if (!data.action || !['approve', 'reject'].includes(data.action)) {
        return Response.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 });
      }

      // Get the suggestion
      const suggestion = await env.DB.prepare(`
        SELECT * FROM enrichment_suggestions WHERE id = ?
      `).bind(suggestionId).first() as any;

      if (!suggestion) {
        return Response.json({ error: 'Suggestion not found' }, { status: 404 });
      }

      if (data.action === 'approve') {
        // Apply the suggestion to the business
        await env.DB.prepare(`
          UPDATE businesses
          SET ${suggestion.field_name} = ?,
              updated_at = unixepoch()
          WHERE id = ?
        `).bind(suggestion.suggested_value, suggestion.business_id).run();

        // Mark as approved
        await env.DB.prepare(`
          UPDATE enrichment_suggestions
          SET status = 'approved',
              reviewed_at = unixepoch(),
              reviewed_by = ?,
              notes = ?
          WHERE id = ?
        `).bind(data.reviewedBy || 'admin', data.notes || null, suggestionId).run();

      } else {
        // Mark as rejected
        await env.DB.prepare(`
          UPDATE enrichment_suggestions
          SET status = 'rejected',
              reviewed_at = unixepoch(),
              reviewed_by = ?,
              notes = ?
          WHERE id = ?
        `).bind(data.reviewedBy || 'admin', data.notes || null, suggestionId).run();
      }

      return Response.json({ success: true, action: data.action });

    } catch (error) {
      console.error('Error reviewing suggestion:', error);
      return Response.json({ error: 'Failed to review suggestion' }, { status: 500 });
    }
  }

  return new Response('API endpoint not found', { status: 404 });
}

const FACEBOOK_SUBMIT_COOKIE = '__Host-kbc_fb_connect';

interface FacebookSubmitSession {
  pages: FacebookManagedPage[];
  selectedPage?: FacebookPageInfo;
  createdAt: number;
}

function getCookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get('Cookie') || '';
  for (const cookie of cookies.split(';')) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function facebookSubmitCookie(sessionId: string): string {
  return `${FACEBOOK_SUBMIT_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
}

function publicFacebookPage(page: FacebookManagedPage): Pick<FacebookManagedPage, 'id' | 'name' | 'category'> {
  return { id: page.id, name: page.name, category: page.category };
}

async function getFacebookSubmitSession(request: Request, env: Env): Promise<{ id: string; session: FacebookSubmitSession } | null> {
  const id = getCookieValue(request, FACEBOOK_SUBMIT_COOKIE);
  if (!id) return null;
  const stored = await env.CACHE.get(`fb_submit_session:${id}`);
  if (!stored) return null;
  try {
    return { id, session: JSON.parse(stored) as FacebookSubmitSession };
  } catch {
    return null;
  }
}

// Read-only Facebook Page connection for the public business submission flow.
async function handleFacebookAuth(path: string, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const supportedPaths = new Set([
    '/auth/facebook',
    '/auth/facebook/callback',
    '/auth/facebook/pages',
    '/auth/facebook/page-info'
  ]);
  if (!supportedPaths.has(path)) {
    return new Response('Not found', { status: 404 });
  }
  if (!(env.FACEBOOK_APP_ID || env.FB_APP_ID) || !(env.FACEBOOK_APP_SECRET || env.FB_APP_SECRET)) {
    return Response.json({ error: 'Facebook integration not configured' }, { status: 503 });
  }

  if (path === '/auth/facebook') {
    const state = crypto.randomUUID();
    await env.CACHE.put(`fb_oauth_state:${state}`, JSON.stringify({ returnTo: '/submit', createdAt: Date.now() }), {
      expirationTtl: 600
    });
    const redirectUri = `${env.SITE_URL}/auth/facebook/callback`;
    return Response.redirect(getFacebookLoginUrl(env, redirectUri, state), 302);
  }

  if (path === '/auth/facebook/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (url.searchParams.has('error')) {
      return Response.redirect(`${env.SITE_URL}/submit?fb_error=not_completed`, 302);
    }
    if (!code || !state) {
      return Response.json({ error: 'Missing code or state parameter' }, { status: 400 });
    }

    const stateKey = `fb_oauth_state:${state}`;
    const storedState = await env.CACHE.get(stateKey);
    if (!storedState) {
      return Response.json({ error: 'Invalid or expired state parameter' }, { status: 400 });
    }
    await env.CACHE.delete(stateKey);

    try {
      const redirectUri = `${env.SITE_URL}/auth/facebook/callback`;
      const tokens = await exchangeCodeForToken(code, env, redirectUri);
      const pages = await getUserPages(tokens.access_token);
      const sessionId = crypto.randomUUID();
      const session: FacebookSubmitSession = { pages, createdAt: Date.now() };
      await env.CACHE.put(`fb_submit_session:${sessionId}`, JSON.stringify(session), { expirationTtl: 3600 });
      const redirectUrl = new URL('/submit', env.SITE_URL);
      redirectUrl.searchParams.set('fb_connected', '1');
      redirectUrl.searchParams.set('fb_pages', pages.length.toString());
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl.toString(), 'Set-Cookie': facebookSubmitCookie(sessionId), 'Cache-Control': 'no-store' }
      });
    } catch {
      console.error('Facebook submission connection failed');
      return Response.redirect(`${env.SITE_URL}/submit?fb_error=auth_failed`, 302);
    }
  }

  if (path === '/auth/facebook/pages') {
    const connection = await getFacebookSubmitSession(request, env);
    if (!connection) return Response.json({ error: 'Connection expired or invalid' }, { status: 401 });
    return Response.json(
      { pages: connection.session.pages.map(publicFacebookPage) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (path === '/auth/facebook/page-info') {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(env.SITE_URL).origin) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 });
    }
    const body: { page_id?: string } = await request.json();
    const pageId = typeof body.page_id === 'string' ? body.page_id : null;
    const connection = await getFacebookSubmitSession(request, env);
    if (!pageId || !connection) {
      return Response.json({ error: 'Missing page or expired connection' }, { status: 401 });
    }
    const managedPage = connection.session.pages.find(page => page.id === pageId);
    if (!managedPage) return Response.json({ error: 'Page is not managed by this connection' }, { status: 403 });

    try {
      const pageInfo = await getPageInfo(pageId, managedPage.access_token);
      connection.session.selectedPage = pageInfo;
      await env.CACHE.put(`fb_submit_session:${connection.id}`, JSON.stringify(connection.session), { expirationTtl: 3600 });
      return Response.json({ pageInfo }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      console.error('Facebook Page lookup failed');
      return Response.json({ error: 'Failed to fetch page information' }, { status: 502 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
