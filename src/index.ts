import { Env } from './types';
import { DatabaseService } from './database';
import { htmlTemplate, homepageContent } from './templates';
import { handleAdminPage } from './admin';
import {
  getFacebookLoginUrl,
  exchangeCodeForToken,
  getUserPages,
  getPageInfo,
  storeTokens,
  getStoredTokens
} from './facebook-oauth';
import {
  handleGoogleLogin,
  handleGoogleCallback,
  handleLogout
} from './auth/google';
import {
  handleFacebookAdminLogin,
  handleFacebookAdminCallback
} from './auth/facebook-admin';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Initialize database service
    const db = new DatabaseService(env.DB);

    // Router
    try {
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
        return await handleCategoryPage(slug, db, env);
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

      // Google OAuth routes (admin authentication)
      if (path === '/auth/google/login') {
        return await handleGoogleLogin(request, env);
      }

      if (path === '/auth/google/callback') {
        return await handleGoogleCallback(request, env, db);
      }

      // Facebook OAuth routes (admin authentication)
      if (path === '/auth/facebook/admin/login') {
        return await handleFacebookAdminLogin(request, env);
      }

      if (path === '/auth/facebook/admin/callback') {
        return await handleFacebookAdminCallback(request, env, db);
      }

      // Logout (works for both Google and Facebook)
      if (path === '/auth/logout') {
        return await handleLogout(request, env, db);
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

      // 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

// Homepage handler
async function handleHomepage(db: DatabaseService, env: Env): Promise<Response> {
  const [categories, featured, stats, blogPosts] = await Promise.all([
    db.getAllCategories(),
    db.getFeaturedBusinesses(6),
    db.getStats(),
    db.getRecentBlogPosts(3)
  ]);

  const content = homepageContent({ categories, featured, stats, blogPosts });
  const html = htmlTemplate('Home - Find Local Businesses', content, env);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Search handler
async function handleSearch(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const city = url.searchParams.get('city') || '';

  const results = await db.searchBusinesses({ query, category, city, limit: 20 });
  const categories = await db.getAllCategories();

  const content = `
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-6">Search Results</h1>
      
      ${results.data.length === 0 ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <p class="text-xl text-gray-700">No businesses found matching your search.</p>
          <p class="text-gray-600 mt-2">Try adjusting your search criteria or <a href="/" class="text-[#ED5409] underline">browse all categories</a></p>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${results.data.map(business => `
            <a href="/business/${business.slug}" class="card-hover bg-white rounded-xl shadow-lg overflow-hidden">
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
                <h3 class="text-lg font-bold text-gray-800 mb-1">${business.name}</h3>
                <p class="text-gray-600 text-sm mb-2">${business.city}, ${business.state}</p>
                ${business.description ? `<p class="text-gray-700 text-sm mb-3 line-clamp-2">${business.description}</p>` : ''}
                <div class="flex items-center">
                  ${business.google_rating ? `
                    <span class="text-yellow-400">⭐</span>
                    <span class="ml-1 font-semibold">${business.google_rating.toFixed(1)}</span>
                    <span class="ml-1 text-gray-500 text-sm">(${business.google_review_count || 0})</span>
                  ` : '<span class="text-gray-500 text-sm">No reviews yet</span>'}
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      `}
    </div>
  `;

  const html = htmlTemplate('Search Results', content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Category page handler
async function handleCategoryPage(slug: string, db: DatabaseService, env: Env): Promise<Response> {
  const category = await db.getCategoryBySlug(slug);
  if (!category) {
    return new Response('Category not found', { status: 404 });
  }

  const businesses = await db.getBusinessesByCategory(slug, 50);

  const content = `
    <div class="gradient-bg text-white py-12">
      <div class="container mx-auto px-4">
        <div class="text-center">
          <div class="text-6xl mb-4">${category.icon || '📁'}</div>
          <h1 class="text-4xl font-bold mb-2">${category.name}</h1>
          <p class="text-xl opacity-90">${category.description || ''}</p>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${businesses.map(business => `
          <a href="/business/${business.slug}" class="card-hover bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="h-40 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
              ${business.image_url ? 
                `<img src="${business.image_url}" alt="${business.name}" class="w-full h-full object-cover">` :
                `<span class="text-5xl">🏪</span>`
              }
            </div>
            <div class="p-4">
              <h3 class="text-lg font-bold text-gray-800 mb-1">${business.name}</h3>
              <p class="text-gray-600 text-sm mb-2">${business.city}, ${business.state}</p>
              ${business.description ? `<p class="text-gray-700 text-sm mb-3 line-clamp-2">${business.description}</p>` : ''}
              <div class="flex items-center">
                ${business.google_rating ? `
                  <span class="text-yellow-400">⭐</span>
                  <span class="ml-1 font-semibold">${business.google_rating.toFixed(1)}</span>
                  <span class="ml-1 text-gray-500 text-sm">(${business.google_review_count || 0})</span>
                ` : '<span class="text-gray-500 text-sm">No reviews yet</span>'}
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
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
async function handleBusinessPage(slug: string, db: DatabaseService, env: Env): Promise<Response> {
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

          ${await renderFacebookPosts(business.id, db, env)}

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
              <label class="block text-sm font-semibold text-gray-700 mb-2">Google Rating</label>
              <input type="number" step="0.1" name="google_rating" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Google Review Count</label>
              <input type="number" name="google_review_count" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Facebook Rating</label>
              <input type="number" step="0.1" name="facebook_rating" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Facebook Review Count</label>
              <input type="number" name="facebook_review_count" class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ED5409]">
            </div>
          </div>

          <div class="flex items-center gap-4">
            <label class="inline-flex items-center"><input type="checkbox" name="is_verified"> <span class="ml-2 text-sm">Verified</span></label>
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

        let fbSession = null;
        let fbPages = [];

        // Check if returning from Facebook OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const session = urlParams.get('fb_session');
        const pagesCount = urlParams.get('fb_pages');
        const fbError = urlParams.get('fb_error');

        if (fbError) {
          showMessage('Facebook login failed: ' + fbError, 'error');
        }

        if (session && pagesCount) {
          fbSession = session;
          loadFacebookPages();
        }

        // Facebook Login Button Click
        fbLoginBtn.addEventListener('click', function() {
          window.location.href = '/auth/facebook?return_to=/submit';
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

            const response = await fetch('/auth/facebook/page-info?session=' + fbSession + '&page_id=' + pageId);
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

            if (pageInfo.overall_star_rating) {
              form.querySelector('[name="facebook_rating"]').value = pageInfo.overall_star_rating;
            }
            if (pageInfo.rating_count) {
              form.querySelector('[name="facebook_review_count"]').value = pageInfo.rating_count;
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
            const response = await fetch('/auth/facebook/pages?session=' + fbSession);
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
  const google_rating = formData.get('google_rating') ? Number(formData.get('google_rating')) : null;
  const google_review_count = formData.get('google_review_count') ? Number(formData.get('google_review_count')) : null;
  const facebook_rating = formData.get('facebook_rating') ? Number(formData.get('facebook_rating')) : null;
  const facebook_review_count = formData.get('facebook_review_count') ? Number(formData.get('facebook_review_count')) : null;
  const is_verified = formData.get('is_verified') ? true : false;
  const website = formData.get('website')?.toString().trim().substring(0, 300) || null;

  const submission = {
    name,
    email,
    // prefer explicit facebook_url field if user provided it, otherwise use parsed one
    facebook_url: facebook_url_explicit || facebook_url,
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
    google_rating,
    google_review_count,
    facebook_rating,
    facebook_review_count,
    is_verified
  };

  // Log a minimal submission summary for observability (avoid logging full PII)
  try {
    console.info('Creating business submission', {
      name: name && name.length ? name.substring(0, 100) : null,
      city,
      state,
      category_id: submission.category_id,
      email_provided: !!email,
      facebook_provided: !!facebook_url
    });

    await db.createBusinessSubmission(submission);
  } catch (error) {
    console.error('DB error creating business submission:', error);
    return new Response('Failed to save submission', { status: 500 });
  }

  // Redirect to success page
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/?submitted=true' }
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

          <!-- Sidebar with Ad Placeholders -->
          <aside class="lg:col-span-4 space-y-6">

            <!-- Ad Space 1 - Top -->
            <div class="glow-card p-6 text-center">
              <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 border-2 border-dashed border-gray-700">
                <p class="text-gray-500 text-sm mb-2">Advertisement</p>
                <p class="text-gray-600 text-xs">300x250</p>
              </div>
            </div>

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

            <!-- Ad Space 2 - Middle -->
            <div class="glow-card p-6 text-center">
              <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 border-2 border-dashed border-gray-700">
                <p class="text-gray-500 text-sm mb-2">Advertisement</p>
                <p class="text-gray-600 text-xs">300x250</p>
              </div>
            </div>

            <!-- Categories -->
            <div class="glow-card p-6">
              <h3 class="text-xl font-bold mb-4 text-primary">Browse Categories</h3>
              <div class="space-y-2">
                <a href="/categories" class="block text-gray-300 hover:text-[#FFCB67] transition-colors">All Categories →</a>
              </div>
            </div>

            <!-- Ad Space 3 - Bottom -->
            <div class="glow-card p-6 text-center sticky top-24">
              <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-12 border-2 border-dashed border-gray-700">
                <p class="text-gray-500 text-sm mb-2">Advertisement</p>
                <p class="text-gray-600 text-xs">300x600</p>
                <p class="text-gray-700 text-xs mt-4">Sticky Ad</p>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  `;

  const html = htmlTemplate(post.title, content, env);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// API handler (for future AJAX endpoints)
async function handleAPI(path: string, request: Request, db: DatabaseService, env: Env): Promise<Response> {
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

// Facebook OAuth handler
async function handleFacebookAuth(path: string, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Check if Facebook app credentials are configured
  // Support both old (FB_APP_ID) and new (FACEBOOK_APP_ID) variable names
  const fbAppId = env.FACEBOOK_APP_ID || env.FB_APP_ID;
  const fbAppSecret = env.FACEBOOK_APP_SECRET || env.FB_APP_SECRET;

  if (!fbAppId || !fbAppSecret) {
    return Response.json({ error: 'Facebook integration not configured' }, { status: 503 });
  }

  // Use the correct variable names for the rest of the function
  env.FB_APP_ID = fbAppId;
  env.FB_APP_SECRET = fbAppSecret;

  // Initiate OAuth flow: /auth/facebook
  if (path === '/auth/facebook') {
    const returnTo = url.searchParams.get('return_to') || '/submit';
    const state = crypto.randomUUID();

    // Store state in KV for validation (expires in 10 minutes)
    await env.CACHE.put(`fb_oauth_state:${state}`, JSON.stringify({ returnTo, timestamp: Date.now() }), {
      expirationTtl: 600
    });

    const redirectUri = `${env.SITE_URL}/auth/facebook/callback`;
    const loginUrl = getFacebookLoginUrl(env, redirectUri, state);

    return Response.redirect(loginUrl, 302);
  }

  // OAuth callback: /auth/facebook/callback
  if (path === '/auth/facebook/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      return Response.redirect(`${env.SITE_URL}/submit?fb_error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !state) {
      return Response.json({ error: 'Missing code or state parameter' }, { status: 400 });
    }

    // Validate state parameter
    const storedState = await env.CACHE.get(`fb_oauth_state:${state}`);
    if (!storedState) {
      return Response.json({ error: 'Invalid or expired state parameter' }, { status: 400 });
    }

    const { returnTo } = JSON.parse(storedState);

    try {
      // Exchange code for access token
      const redirectUri = `${env.SITE_URL}/auth/facebook/callback`;
      const tokens = await exchangeCodeForToken(code, env, redirectUri);

      // Get user's Facebook pages
      const pages = await getUserPages(tokens.access_token);

      // Store tokens in session (using a random session ID)
      const sessionId = crypto.randomUUID();
      await storeTokens(env, `session:${sessionId}`, tokens);

      // Store pages data temporarily
      await env.CACHE.put(`fb_pages:${sessionId}`, JSON.stringify(pages), {
        expirationTtl: 3600 // 1 hour
      });

      // Redirect to page selection or back to return URL with session
      const redirectUrl = new URL(returnTo, env.SITE_URL);
      redirectUrl.searchParams.set('fb_session', sessionId);
      redirectUrl.searchParams.set('fb_pages', pages.length.toString());

      return Response.redirect(redirectUrl.toString(), 302);

    } catch (error) {
      console.error('Facebook OAuth error:', error);
      return Response.redirect(`${env.SITE_URL}/submit?fb_error=auth_failed`, 302);
    }
  }

  // Get pages for a session: /auth/facebook/pages
  if (path === '/auth/facebook/pages') {
    const sessionId = url.searchParams.get('session');

    if (!sessionId) {
      return Response.json({ error: 'Missing session parameter' }, { status: 400 });
    }

    const pagesData = await env.CACHE.get(`fb_pages:${sessionId}`);

    if (!pagesData) {
      return Response.json({ error: 'Session expired or invalid' }, { status: 404 });
    }

    try {
      const pages = JSON.parse(pagesData);
      return Response.json({ pages });
    } catch {
      return Response.json({ error: 'Invalid pages data' }, { status: 500 });
    }
  }

  // Get page info: /auth/facebook/page-info?session=xxx&page_id=yyy
  if (path === '/auth/facebook/page-info') {
    const sessionId = url.searchParams.get('session');
    const pageId = url.searchParams.get('page_id');

    if (!sessionId || !pageId) {
      return Response.json({ error: 'Missing session or page_id parameter' }, { status: 400 });
    }

    // Get stored tokens
    const tokens = await getStoredTokens(env, `session:${sessionId}`);

    if (!tokens) {
      return Response.json({ error: 'Session expired or invalid' }, { status: 404 });
    }

    try {
      // Get detailed page information
      const pageInfo = await getPageInfo(pageId, tokens.access_token);

      return Response.json({ pageInfo });
    } catch (error) {
      console.error('Error fetching page info:', error);
      return Response.json({ error: 'Failed to fetch page information' }, { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
