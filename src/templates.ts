const BIGFOOT_ASSET_BASE = 'https://pub-103d4ad9e7aa46008f10c0a93163608f.r2.dev/assets/bigfoot/v1/poses';

const BIGFOOT_POSES = {
    celebrate: `${BIGFOOT_ASSET_BASE}/celebrate.png`,
    point: `${BIGFOOT_ASSET_BASE}/point.png`,
    thinking: `${BIGFOOT_ASSET_BASE}/thinking.png`,
    thumbsUp: `${BIGFOOT_ASSET_BASE}/thumbs-up.png`,
    walk: `${BIGFOOT_ASSET_BASE}/walk.png`,
    wave: `${BIGFOOT_ASSET_BASE}/wave.png`
} as const;

const bigfootAvatar = (pose: keyof typeof BIGFOOT_POSES, alt: string, className: string, id?: string) =>
    `<img${id ? ` id="${id}"` : ''} src="${BIGFOOT_POSES[pose]}" alt="${alt}" class="bigfoot-avatar ${className}" loading="lazy" decoding="async">`;

export const htmlTemplate = (title: string, content: string, env: any, extraHead: string = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | ${env.SITE_NAME}</title>
    <meta name="description" content="Find local service businesses in Southeast Oklahoma, Northeast Texas, and Southwest Arkansas">
    ${extraHead}
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            (function() {
                const FB_APP_ID = '${env.FB_APP_ID || ''}';
                const FB_API_VERSION = '${env.FB_API_VERSION || 'v17.0'}';

                if (!FB_APP_ID) {
                    // No FB app configured for this environment
                    console.warn('FB_APP_ID not configured; Facebook SDK will not be loaded.');
                    return;
                }

                // Initialize the SDK once it's loaded and check login status
                window.fbAsyncInit = function() {
                    FB.init({
                        appId      : FB_APP_ID,
                        cookie     : true,
                        xfbml      : true,
                        version    : FB_API_VERSION
                    });

                    try { FB.AppEvents.logPageView(); } catch (e) { /* ignore */ }

                    // Check login status as soon as the SDK is initialized
                    try {
                        FB.getLoginStatus(function(response) {
                            if (typeof window.statusChangeCallback === 'function') {
                                window.statusChangeCallback(response);
                            } else {
                                console.log('FB.getLoginStatus response', response);
                            }
                        });
                    } catch (e) { console.warn('FB.getLoginStatus failed', e); }
                };

                // Load the SDK asynchronously
                (function(d, s, id){
                     var js, fjs = d.getElementsByTagName(s)[0];
                     if (d.getElementById(id)) {return;}
                     js = d.createElement(s); js.id = id;
                       js.src = 'https://connect.facebook.net/en_US/sdk.js';
                     fjs.parentNode.insertBefore(js, fjs);
                 }(document, 'script', 'facebook-jssdk'));

                // Provide default helper callbacks if the page doesn't include them
                window.statusChangeCallback = window.statusChangeCallback || function(response) {
                    // Default behavior: log and, if connected, post the auth response to our server API
                    console.log('statusChangeCallback', response);
                    if (response && response.status === 'connected' && response.authResponse) {
                        try {
                            fetch('/api/facebook/auth', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ authResponse: response.authResponse })
                            }).catch(() => {});
                        } catch (e) {}
                    }
                };

                window.checkLoginState = window.checkLoginState || function() {
                    try {
                        FB.getLoginStatus(function(response) {
                            window.statusChangeCallback(response);
                        });
                    } catch (e) { console.warn('checkLoginState failed', e); }
                };
            })();
        </script>
    <style>
        /* Dark Theme Base */
        body {
            background: #0a0a0a;
            color: #e0e0e0;
        }

        /* Gradient Background */
        .gradient-bg {
            background: linear-gradient(135deg, #FFCB67 0%, #ED5409 50%, #214E81 100%);
            position: relative;
        }
        .gradient-bg::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255,203,103,0.1) 0%, rgba(237,84,9,0.1) 50%, rgba(33,78,129,0.1) 100%);
        }

        /* Glowing Cards */
        .glow-card {
            background: rgba(20, 20, 25, 0.8);
            border: 1px solid rgba(255, 203, 103, 0.1);
            border-radius: 16px;
            position: relative;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow:
                0 4px 20px rgba(0, 0, 0, 0.5),
                inset 0 1px 0 rgba(255, 203, 103, 0.1);
        }

        .glow-card::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 16px;
            padding: 1px;
            background: linear-gradient(135deg,
                rgba(255, 203, 103, 0.3) 0%,
                rgba(237, 84, 9, 0.3) 50%,
                rgba(33, 78, 129, 0.3) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0;
            transition: opacity 0.4s ease;
        }

        .glow-card:hover {
            transform: translateY(-8px);
            border-color: rgba(255, 203, 103, 0.3);
            box-shadow:
                0 8px 40px rgba(237, 84, 9, 0.3),
                0 0 60px rgba(255, 203, 103, 0.2),
                inset 0 1px 0 rgba(255, 203, 103, 0.2);
        }

        .glow-card:hover::before {
            opacity: 1;
        }

        /* Pulsing Glow Animation */
        @keyframes glow-pulse {
            0%, 100% {
                box-shadow:
                    0 0 20px rgba(237, 84, 9, 0.4),
                    0 0 40px rgba(255, 203, 103, 0.2);
            }
            50% {
                box-shadow:
                    0 0 30px rgba(237, 84, 9, 0.6),
                    0 0 60px rgba(255, 203, 103, 0.3);
            }
        }

        .featured-glow {
            animation: glow-pulse 3s ease-in-out infinite;
        }

        /* Category Cards with Subtle Glow */
        .category-card {
            background: rgba(25, 25, 30, 0.6);
            border: 1px solid rgba(100, 100, 120, 0.2);
            border-radius: 12px;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .category-card:hover {
            background: rgba(35, 35, 45, 0.8);
            border-color: rgba(237, 84, 9, 0.5);
            box-shadow: 0 0 30px rgba(237, 84, 9, 0.3);
            transform: translateY(-5px);
        }

        /* Search Container Dark */
        .search-container {
            background: rgba(20, 20, 25, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 203, 103, 0.2);
            box-shadow:
                0 8px 32px rgba(0, 0, 0, 0.4),
                0 0 80px rgba(237, 84, 9, 0.2);
        }

        /* Input Styles Dark */
        .dark-input {
            background: rgba(30, 30, 35, 0.8);
            border: 1px solid rgba(100, 100, 120, 0.3);
            color: #e0e0e0;
        }

        .dark-input:focus {
            outline: none;
            border-color: #ED5409;
            box-shadow: 0 0 0 3px rgba(237, 84, 9, 0.2);
        }

        /* Button Glow */
        .btn-glow {
            background: linear-gradient(135deg, #ED5409 0%, #FF6B35 100%);
            box-shadow: 0 4px 20px rgba(237, 84, 9, 0.4);
            transition: all 0.3s ease;
        }

        .btn-glow:hover {
            box-shadow: 0 6px 30px rgba(237, 84, 9, 0.6);
            transform: translateY(-2px);
        }

        /* Header Dark */
        .header-dark {
            background: rgba(15, 15, 20, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(100, 100, 120, 0.2);
        }

        /* Footer Dark */
        .footer-dark {
            background: #0a0a0a;
            border-top: 1px solid rgba(100, 100, 120, 0.2);
        }

        /* Text Colors */
        .text-primary { color: #e0e0e0; }
        .text-secondary { color: #a0a0a0; }
        .sonic-orange { color: #ED5409; }
        .sonic-gold { color: #FFCB67; }
        .sonic-blue { color: #214E81; }

        /* Utility Classes */
        .bg-dark-card { background: rgba(20, 20, 25, 0.8); }
        .border-glow { border: 1px solid rgba(255, 203, 103, 0.2); }

        .reveal-on-scroll {
            opacity: 0;
            transform: translateY(24px) scale(0.985);
            transition: opacity 560ms ease, transform 560ms ease, box-shadow 400ms ease, border-color 400ms ease;
            will-change: transform, opacity;
        }

        .reveal-on-scroll.is-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .bigfoot-avatar {
            display: block;
            object-fit: contain;
            transition: transform 240ms ease, filter 240ms ease;
        }

        .bigfoot-logo {
            height: 4.5rem;
            width: 4.5rem;
            filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35));
        }

        .bigfoot-logo:hover,
        .bigfoot-logo:focus-visible {
            transform: translateY(-2px) rotate(-3deg) scale(1.06);
            filter: drop-shadow(0 12px 24px rgba(237, 84, 9, 0.45));
        }

        .bigfoot-peek {
            position: absolute;
            right: clamp(0.5rem, 5vw, 4rem);
            bottom: -1.25rem;
            z-index: 20;
            width: clamp(7rem, 16vw, 12rem);
            transform-origin: bottom center;
            animation: bigfoot-peek 4.5s ease-in-out infinite;
            pointer-events: none;
        }

        @keyframes bigfoot-peek {
            0%, 100% { transform: translateY(0) rotate(3deg); }
            50% { transform: translateY(-0.55rem) rotate(-3deg); }
        }

        .bigfoot-bidder {
            width: 5.5rem;
            height: 5.5rem;
            margin-right: -0.5rem;
            margin-top: -1.25rem;
            transform: rotate(5deg);
        }

        .bigfoot-bidder:hover {
            transform: rotate(-5deg) scale(1.08);
        }

        .bigfoot-wave {
            width: clamp(5.5rem, 11vw, 8rem);
            height: clamp(5.5rem, 11vw, 8rem);
            margin-right: -0.5rem;
            transform: rotate(-4deg);
        }

        .bigfoot-wave:hover {
            transform: rotate(4deg) scale(1.08);
        }

        @media (prefers-reduced-motion: reduce) {
            .bigfoot-avatar,
            .bigfoot-logo,
            .bigfoot-peek,
            .bigfoot-bidder {
                animation: none;
                transition: none;
            }

            .bigfoot-wave {
                transform: none;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header-dark sticky top-0 z-50">
        <nav class="container mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
                <a href="/" class="flex items-center">
                    ${bigfootAvatar('celebrate', `${env.SITE_NAME} Bigfoot mascot`, 'bigfoot-logo')}
                </a>
                <div class="hidden md:flex space-x-6">
                    <a href="/" class="text-gray-300 hover:text-[#FFCB67] transition-colors">Home</a>
                    <a href="/categories" class="text-gray-300 hover:text-[#FFCB67] transition-colors">Categories</a>
                    <a href="/blog" class="text-gray-300 hover:text-[#FFCB67] transition-colors">Blog</a>
                    <a href="/submit" class="text-gray-300 hover:text-[#FFCB67] transition-colors">List Your Business</a>
                </div>
                <a href="/submit" class="btn-glow text-white px-6 py-2 rounded-lg font-semibold">
                    Add Business
                </a>
            </div>
        </nav>
    </header>

    <!-- Main Content -->
    <main>
        ${content}
    </main>

    <!-- Footer -->
    <footer class="footer-dark text-white mt-16">
        <div class="container mx-auto px-4 py-12">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    ${bigfootAvatar('celebrate', `${env.SITE_NAME} Bigfoot mascot`, 'bigfoot-logo mb-4')}
                    <p class="text-gray-400">Your local business directory for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas</p>
                </div>
                <div>
                    <h4 class="font-bold mb-4 sonic-gold">Quick Links</h4>
                    <ul class="space-y-2">
                        <li><a href="/" class="text-gray-400 hover:text-[#FFCB67] transition-colors">Home</a></li>
                        <li><a href="/categories" class="text-gray-400 hover:text-[#FFCB67] transition-colors">Categories</a></li>
                        <li><a href="/blog" class="text-gray-400 hover:text-[#FFCB67] transition-colors">Blog</a></li>
                        <li><a href="/about" class="text-gray-400 hover:text-[#FFCB67] transition-colors">About Us</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold mb-4 sonic-gold">For Businesses</h4>
                    <ul class="space-y-2">
                        <li><a href="/submit" class="text-gray-400 hover:text-[#FFCB67] transition-colors">List Your Business</a></li>
                        <li><a href="/advertise" class="text-gray-400 hover:text-[#FFCB67] transition-colors">Advertise</a></li>
                        <li><a href="/pricing" class="text-gray-400 hover:text-[#FFCB67] transition-colors">Pricing</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold mb-4 sonic-gold">Service Area</h4>
                    <p class="text-gray-400">Southeast Oklahoma</p>
                    <p class="text-gray-400">Northeast Texas</p>
                    <p class="text-gray-400">Southwest Arkansas</p>
                </div>
            </div>
            <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                <p>&copy; 2024 ${env.SITE_NAME}. All rights reserved.</p>
            </div>
        </div>
    </footer>
</body>
</html>
`;

export const homepageContent = (data: any) => `
    <!-- Hero Section -->
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-4 text-center">
            <h1 class="text-5xl font-bold mb-6">Find Local Service Businesses</h1>
            <p class="text-xl mb-8 opacity-90">Discover trusted businesses in Southeast Oklahoma, Northeast Texas & Southwest Arkansas</p>
            
            <!-- Search Bar -->
            <div class="max-w-4xl mx-auto search-container rounded-2xl p-6 shadow-2xl relative z-10">
                <form action="/search" method="GET" class="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        name="q"
                        placeholder="What are you looking for?"
                        class="flex-1 px-6 py-4 rounded-lg dark-input text-lg"
                    >
                    <select
                        name="category"
                        class="px-6 py-4 rounded-lg dark-input text-lg"
                    >
                        <option value="">All Categories</option>
                        ${data.categories.map((cat: any) => `<option value="${cat.slug}">${cat.name}</option>`).join('')}
                    </select>
                    <button type="submit" class="btn-glow text-white px-8 py-4 rounded-lg font-semibold text-lg">
                        Search
                    </button>
                </form>
            </div>
            ${bigfootAvatar('point', 'Bigfoot Jr. cheering on your search', 'bigfoot-peek')}

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-12">
                <div>
                    <div class="text-4xl font-bold">${data.stats.businesses}+</div>
                    <div class="text-sm opacity-80">Businesses</div>
                </div>
                <div>
                    <div class="text-4xl font-bold">${data.stats.categories}+</div>
                    <div class="text-sm opacity-80">Categories</div>
                </div>
                <div>
                    <div class="text-4xl font-bold">${data.stats.cities}+</div>
                    <div class="text-sm opacity-80">Cities</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Sponsored placements -->
    <section class="container mx-auto px-4 pt-12" aria-labelledby="sponsored-heading">
        <div class="flex items-center justify-between gap-4 mb-6">
            <div>
                <p class="text-xs uppercase tracking-widest text-secondary">Paid visibility</p>
                <h2 id="sponsored-heading" class="text-2xl font-bold text-primary">Sponsored Local Spotlights</h2>
            </div>
            <div class="flex items-center gap-2">
                ${bigfootAvatar('wave', 'Bigfoot Jr. waving at sponsored businesses', 'bigfoot-wave')}
                <span class="hidden sm:inline text-xs text-secondary">Clearly labeled advertising</span>
            </div>
        </div>
        ${data.sponsored?.length ? `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${data.sponsored.map((business: any) => `
                <a href="/business/${business.slug}" class="glow-card border-2 border-[#ED5409]/50" aria-label="Sponsored: ${business.name}">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold uppercase tracking-widest text-[#ED5409]">Sponsored</span>
                            ${business.is_verified ? '<span class="text-blue-400">✓ Verified</span>' : ''}
                        </div>
                        <h3 class="text-xl font-bold text-primary">${business.name}</h3>
                        <p class="text-secondary text-sm mt-1">${business.city}, ${business.state}</p>
                        ${business.description ? `<p class="text-gray-300 mt-3 line-clamp-2">${business.description}</p>` : ''}
                        <span class="inline-block mt-4 sonic-orange font-semibold">View sponsored profile →</span>
                    </div>
                </a>
            `).join('')}
        </div>
        ` : `
        <div class="glow-card border-2 border-[#ED5409]/40 p-8">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <p class="text-xs uppercase tracking-widest text-secondary mb-2">Auction inventory</p>
                    <h3 class="text-2xl font-bold text-primary mb-3">Paid placements are available through the auction</h3>
                    <p class="text-gray-300 max-w-3xl">When no business is winning a live slot, we show the inventory here and point advertisers to the current floors, rules, and next steps.</p>
                </div>
                <div class="flex flex-col gap-3 min-w-[240px]">
                    <a href="/advertise" class="btn-glow text-white px-6 py-3 rounded-lg font-semibold text-center">Advertise</a>
                    <a href="/pricing" class="border border-[#ED5409]/50 text-[#FFCB67] px-6 py-3 rounded-lg font-semibold text-center hover:bg-[#ED5409]/10 transition-colors">See pricing</a>
                </div>
            </div>
        </div>
        `}
    </section>

    <!-- Featured Businesses -->
    <section class="container mx-auto px-4 py-16">
        <h2 class="text-3xl font-bold text-center mb-12 text-primary">Featured Businesses</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${data.featured.map((business: any) => `
                <a href="/business/${business.slug}" class="glow-card featured-glow">
                    <div class="h-48 bg-gradient-to-br from-[#FFCB67] to-[#ED5409] flex items-center justify-center relative overflow-hidden">
                        ${business.image_url ?
                            `<img src="${business.image_url}" alt="${business.name}" class="w-full h-full object-cover">` :
                            business.facebook_image_url ?
                            `<img src="${business.facebook_image_url}" alt="${business.name}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <span class="hidden text-6xl">🏪</span>` :
                            `<span class="text-6xl">🏪</span>`
                        }
                    </div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xl font-bold text-primary">${business.name}</h3>
                            ${business.is_verified ? '<span class="text-blue-400">✓</span>' : ''}
                        </div>
                        <p class="text-secondary text-sm mb-3">${business.city}, ${business.state}</p>
                        ${business.description ? `<p class="text-gray-300 mb-4 line-clamp-2">${business.description}</p>` : ''}
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                ${business.google_rating ? `
                                    <span class="text-yellow-400">⭐</span>
                                    <span class="ml-1 font-semibold text-primary">${business.google_rating.toFixed(1)}</span>
                                    <span class="ml-1 text-secondary text-sm">(${business.google_review_count || 0})</span>
                                ` : '<span class="text-secondary text-sm">No reviews yet</span>'}
                            </div>
                            <span class="sonic-orange font-semibold">View Details →</span>
                        </div>
                    </div>
                </a>
            `).join('')}
        </div>
    </section>

    <!-- Categories Grid -->
    <section class="py-16">
        <div class="container mx-auto px-4">
            <h2 class="text-3xl font-bold text-center mb-12 text-primary">Browse by Category</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                ${data.categories.map((cat: any) => `
                    <a href="/category/${cat.slug}" class="category-card p-6 text-center">
                        <div class="text-4xl mb-3">${cat.icon || '📁'}</div>
                        <h3 class="font-semibold text-primary">${cat.name}</h3>
                        <p class="text-sm text-secondary mt-1">Browse →</p>
                    </a>
                `).join('')}
            </div>
        </div>
    </section>

    <!-- Recent Blog Posts -->
    ${data.blogPosts && data.blogPosts.length > 0 ? `
    <section class="container mx-auto px-4 py-16">
        <div class="flex justify-between items-center mb-12">
            <h2 class="text-3xl font-bold text-primary">Featured Business Spotlights</h2>
            <a href="/blog" class="sonic-orange font-semibold hover:text-[#FFCB67] transition-colors">View All →</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            ${data.blogPosts.slice(0, 3).map((post: any) => `
                <article class="glow-card">
                    <div class="h-48 bg-gradient-to-br from-[#214E81] to-[#ED5409]"></div>
                    <div class="p-6">
                        <h3 class="text-xl font-bold mb-2 text-primary">${post.title}</h3>
                        <p class="text-secondary mb-4">${post.excerpt || ''}</p>
                        <a href="/blog/${post.slug}" class="sonic-orange font-semibold hover:text-[#FFCB67] transition-colors">Read More →</a>
                    </div>
                </article>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- CTA Section -->
    <section class="gradient-bg text-white py-16 relative">
        <div class="container mx-auto px-4 text-center relative z-10">
            <h2 class="text-3xl font-bold mb-4">Ready to Grow Your Business?</h2>
            <p class="text-xl mb-8 opacity-90">Get featured on KiamichiBizConnect and reach thousands of local customers</p>
            <div class="flex flex-col md:flex-row justify-center gap-4">
                <a href="/submit" class="btn-glow text-white px-8 py-4 rounded-lg font-semibold text-lg inline-block">
                    List Your Business Today
                </a>
                <a href="/advertise" class="border border-white/40 text-white px-8 py-4 rounded-lg font-semibold text-lg inline-block hover:bg-white/10 transition-colors">
                    Advertise with the auction
                </a>
            </div>
        </div>
    </section>
`;

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const auctionTierCard = (title: string, fallback: { placementType: string; floorCents: number; summary: string }, status: any) => {
    const current = status || { tier: { label: title, placement_type: fallback.placementType, floor_cents: fallback.floorCents }, openingBidCents: fallback.floorCents, currentBidCents: fallback.floorCents, paymentStatus: 'pending-square', currentBusinessId: null };
    const tierId = title === 'Regional Spotlight' ? 'regional-spotlight' : 'local-spotlight';
    const formId = `auction-form-${tierId}`;
    const messageId = `auction-message-${tierId}`;
    const avatarId = `auction-bigfoot-${tierId}`;
    return `
        <div class="glow-card border border-[#ED5409]/30 p-6">
            <div class="flex items-center justify-between gap-4 mb-4">
                <div>
                    <p class="text-xs uppercase tracking-widest text-secondary">${current.tier.placement_type}</p>
                    <h3 class="text-2xl font-bold text-primary">${current.tier.label}</h3>
                </div>
                <div class="flex items-start gap-2">
                    ${bigfootAvatar('thumbsUp', 'Bigfoot Jr. rooting for local bidders', 'bigfoot-bidder', avatarId)}
                    <span class="text-xs font-bold uppercase tracking-widest text-[#FFCB67] border border-[#FFCB67]/30 rounded-full px-3 py-1">${current.paymentStatus}</span>
                </div>
            </div>
            <p class="text-gray-300 mb-4">${fallback.summary}</p>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="rounded-xl bg-black/20 border border-white/5 p-4">
                    <div class="text-xs uppercase tracking-widest text-secondary">Floor</div>
                    <div class="text-2xl font-bold mt-1 text-[#FFCB67]">${formatMoney(current.tier.floor_cents)}</div>
                </div>
                <div class="rounded-xl bg-black/20 border border-white/5 p-4">
                    <div class="text-xs uppercase tracking-widest text-secondary">Current</div>
                    <div class="text-2xl font-bold mt-1 text-[#FFCB67]">${formatMoney(current.currentBidCents)}</div>
                </div>
            </div>
            <div class="text-sm text-gray-400">
                Current slot status: ${current.currentBusinessId ? 'Occupied' : 'Open'} · Opening bid ${formatMoney(current.openingBidCents)} · Winner holds for 24 hours unless beaten
            </div>
            <form id="${formId}" class="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div>
                    <label class="block text-sm font-semibold text-gray-200" for="${formId}-business">Business name</label>
                    <input id="${formId}-business" name="business_name" type="text" required autocomplete="organization" placeholder="Example: Twisted Custom Leather" class="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#FFCB67] focus:outline-none">
                    <p class="mt-1 text-xs text-gray-400">We match this to an existing listing when possible. Businesses not yet listed can advertise too.</p>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-200" for="${formId}-bid">Your bid in USD</label>
                    <input id="${formId}-bid" name="bid_dollars" type="number" inputmode="decimal" min="${(current.currentBidCents / 100 + 0.01).toFixed(2)}" step="0.01" required placeholder="${(current.currentBidCents / 100 + 1).toFixed(2)}" class="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#FFCB67] focus:outline-none">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-200" for="${formId}-email">Contact email</label>
                        <input id="${formId}-email" name="contact_email" type="email" required autocomplete="email" placeholder="you@business.com" class="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#FFCB67] focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-200" for="${formId}-city">City / state if not listed</label>
                        <input id="${formId}-city" name="business_location" type="text" autocomplete="address-level2" placeholder="Broken Bow, OK" class="mt-2 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#FFCB67] focus:outline-none">
                    </div>
                </div>
                <button type="submit" class="w-full rounded-lg bg-[#ED5409] px-5 py-3 font-bold text-white transition hover:bg-[#ff6a1f]">Place bid</button>
                <p id="${messageId}" class="text-sm text-gray-300" role="status">You are not charged just for submitting a bid. Payment is only completed through Square if you remain the winner and choose to pay.</p>
            </form>
            <script>
                (() => {
                    const form = document.getElementById('${formId}');
                    const message = document.getElementById('${messageId}');
                    const avatar = document.getElementById('${avatarId}');
                    if (!form || !message) return;
                    form.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const data = new FormData(form);
                        const businessName = String(data.get('business_name') || '').trim();
                        const contactEmail = String(data.get('contact_email') || '').trim();
                        const businessLocation = String(data.get('business_location') || '').trim();
                        const bidDollars = Number(data.get('bid_dollars'));
                        const bidCents = Math.round(bidDollars * 100);
                        if (!businessName || !contactEmail || !Number.isFinite(bidDollars) || bidCents < ${current.currentBidCents + 1}) {
                            message.textContent = 'Enter a business name, contact email, and a bid higher than the current bid.';
                            return;
                        }
                        const button = form.querySelector('button[type="submit"]');
                        if (button) { button.disabled = true; button.textContent = 'Submitting...'; }
                        if (avatar) avatar.src = '${BIGFOOT_POSES.thinking}';
                        try {
                            const response = await fetch('/api/auctions/${tierId}/bids', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ business_name: businessName, contact_email: contactEmail, business_location: businessLocation, bid_cents: bidCents })
                            });
                            const result = await response.json();
                            if (!response.ok) throw new Error(result.error || result.reason || 'Bid was not accepted');
                            message.innerHTML = result.checkoutUrl
                                ? 'Bid submitted. Complete the Square checkout only if you want to hold the winning slot: <a class="text-[#FFCB67] underline" href="' + result.checkoutUrl + '" target="_blank" rel="noopener">Continue to Square</a>'
                                : 'Bid submitted and waiting for Square checkout configuration.';
                            if (avatar) avatar.src = '${BIGFOOT_POSES.celebrate}';
                        } catch (error) {
                            message.textContent = error instanceof Error ? error.message : 'Bid submission failed. Please try again.';
                            if (avatar) avatar.src = '${BIGFOOT_POSES.thinking}';
                            if (button) { button.disabled = false; button.textContent = 'Place bid'; }
                        }
                    });
                })();
            </script>
        </div>
    `;
};

export const aboutPageContent = (data: any) => `
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl">
                <p class="text-xs uppercase tracking-widest opacity-80 mb-4">About KiamichiBizConnect</p>
                <h1 class="text-5xl font-bold mb-6">We help local businesses get found by real neighbors.</h1>
                <p class="text-xl opacity-90 max-w-3xl">KiamichiBizConnect is the local directory for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas — built to make discovery easy, sponsorships clear, and business pages useful.</p>
                <div class="flex flex-col md:flex-row gap-4 mt-8">
                    <a href="/submit" class="btn-glow text-white px-7 py-3 rounded-lg font-semibold text-lg inline-block text-center">List your business</a>
                    <a href="/advertise" class="border border-white/40 text-white px-7 py-3 rounded-lg font-semibold text-lg inline-block text-center hover:bg-white/10 transition-colors">See advertising</a>
                </div>
            </div>
        </div>
    </section>

    <section class="container mx-auto px-4 py-16">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div class="glow-card p-6"><div class="text-4xl font-bold text-[#FFCB67]">${data.stats.businesses}+</div><div class="text-secondary mt-2">Active businesses</div></div>
            <div class="glow-card p-6"><div class="text-4xl font-bold text-[#FFCB67]">${data.stats.categories}+</div><div class="text-secondary mt-2">Categories</div></div>
            <div class="glow-card p-6"><div class="text-4xl font-bold text-[#FFCB67]">${data.stats.cities}+</div><div class="text-secondary mt-2">Cities covered</div></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="glow-card p-8">
                <h2 class="text-2xl font-bold mb-4 text-primary">What we do</h2>
                <p class="text-gray-300 mb-4">We surface local businesses with clean profiles, search, business spotlights, and a clear path to paid visibility. The goal is simple: help customers find trusted local services faster.</p>
                <p class="text-gray-300">The directory is designed for service businesses, home services, retail, food, and community organizations across the regional footprint.</p>
            </div>
            <div class="glow-card p-8">
                <h2 class="text-2xl font-bold mb-4 text-primary">Why it exists</h2>
                <p class="text-gray-300 mb-4">Local businesses often get buried in noisy search results. KiamichiBizConnect gives them a place to present their services, contact details, and reputation in one place.</p>
                <p class="text-gray-300">Advertising is labeled, sponsorship is explicit, and every page is built to stay useful for customers first.</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div class="category-card p-6"><h3 class="font-bold text-primary mb-2">Clear discovery</h3><p class="text-secondary">Search by category, city, or business name.</p></div>
            <div class="category-card p-6"><h3 class="font-bold text-primary mb-2">Straightforward promotion</h3><p class="text-secondary">Paid placements are labeled and easy to understand.</p></div>
            <div class="category-card p-6"><h3 class="font-bold text-primary mb-2">Regional coverage</h3><p class="text-secondary">Built for the tri-state service area we actually serve.</p></div>
        </div>
    </section>
`;

export const advertisePageContent = (data: any) => `
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl">
                <p class="text-xs uppercase tracking-widest opacity-80 mb-4">Advertise</p>
                <h1 class="text-5xl font-bold mb-6">Run a sponsored placement on the directory.</h1>
                <p class="text-xl opacity-90 max-w-3xl">Advertising is auction-based. Businesses bid for placement, Square payment verification activates the slot, and the homepage clearly labels the sponsored inventory.</p>
            </div>
        </div>
    </section>

    <section class="container mx-auto px-4 py-16">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            ${auctionTierCard('Local Spotlight', { placementType: 'homepage-featured', floorCents: 500, summary: 'Best for businesses that want a visible homepage sponsor slot in the local market.' }, data.localAuction)}
            ${auctionTierCard('Regional Spotlight', { placementType: 'sidebar', floorCents: 2500, summary: 'Broader reach for brands that want to show up in a premium sponsored placement.' }, data.regionalAuction)}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
            <div class="glow-card p-6"><div class="text-sm uppercase tracking-widest text-secondary mb-2">1</div><h3 class="text-xl font-bold text-primary mb-2">Choose a tier</h3><p class="text-gray-300">Start with the floor shown on the pricing page.</p></div>
            <div class="glow-card p-6"><div class="text-sm uppercase tracking-widest text-secondary mb-2">2</div><h3 class="text-xl font-bold text-primary mb-2">Submit the bid</h3><p class="text-gray-300">The auction accepts only strictly higher bids.</p></div>
            <div class="glow-card p-6"><div class="text-sm uppercase tracking-widest text-secondary mb-2">3</div><h3 class="text-xl font-bold text-primary mb-2">Verify payment</h3><p class="text-gray-300">Square completion is required before activation.</p></div>
            <div class="glow-card p-6"><div class="text-sm uppercase tracking-widest text-secondary mb-2">4</div><h3 class="text-xl font-bold text-primary mb-2">Go live</h3><p class="text-gray-300">Once active, the slot is labeled across the directory.</p></div>
        </div>

        <div class="glow-card p-8 mt-10">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-primary">Need a walkthrough?</h2>
                    <p class="text-gray-300 mt-2">We can help you choose the right tier and explain the auction timing before you place a bid.</p>
                </div>
                <div class="flex gap-3 flex-wrap">
                    <a href="/pricing" class="border border-[#ED5409]/50 text-[#FFCB67] px-6 py-3 rounded-lg font-semibold hover:bg-[#ED5409]/10 transition-colors">View pricing</a>
                    <a href="/submit" class="btn-glow text-white px-6 py-3 rounded-lg font-semibold">List your business</a>
                </div>
            </div>
        </div>
    </section>
`;

export const pricingPageContent = (data: any) => `
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl">
                <p class="text-xs uppercase tracking-widest opacity-80 mb-4">Pricing</p>
                <h1 class="text-5xl font-bold mb-6">Current auction floors and placement pricing.</h1>
                <p class="text-xl opacity-90 max-w-3xl">Prices are auction floors, not fixed subscriptions. The live bid determines who wins the slot, and the page below shows the current minimums.</p>
            </div>
        </div>
    </section>

    <section class="container mx-auto px-4 py-16">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            ${auctionTierCard('Local Spotlight', { placementType: 'homepage-featured', floorCents: 500, summary: 'Homepage spotlight for local businesses looking for strong visibility on the front page.' }, data.localAuction)}
            ${auctionTierCard('Regional Spotlight', { placementType: 'sidebar', floorCents: 2500, summary: 'Premium sponsored placement for businesses that want broader regional attention.' }, data.regionalAuction)}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div class="glow-card p-6"><h3 class="text-xl font-bold text-primary mb-2">Floor means minimum</h3><p class="text-gray-300">The auction starts at the floor shown on the card. Higher bids win.</p></div>
            <div class="glow-card p-6"><h3 class="text-xl font-bold text-primary mb-2">One winner per slot</h3><p class="text-gray-300">Within an active hour, the current winner stays until a strictly higher bid arrives.</p></div>
            <div class="glow-card p-6"><h3 class="text-xl font-bold text-primary mb-2">Payment gate</h3><p class="text-gray-300">A bid stays pending until Square confirms the payment server-side.</p></div>
        </div>

        <div class="glow-card p-8 mt-10">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <h2 class="text-2xl font-bold text-primary mb-3">How the pricing works</h2>
                    <ul class="space-y-3 text-gray-300 list-disc list-inside">
                        <li>Daily auction cycle starts at 7:00 a.m. America/Chicago.</li>
                        <li>The opening bid is based on the prior day’s winning history when available.</li>
                        <li>Empty or stale history falls back to the tier floor.</li>
                        <li>Sponsored placements are always labeled on the live site.</li>
                    </ul>
                </div>
                <div class="rounded-2xl bg-black/20 border border-white/5 p-6">
                    <div class="text-xs uppercase tracking-widest text-secondary mb-3">Current status</div>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between"><span class="text-gray-300">Local Spotlight</span><span class="font-bold text-[#FFCB67]">${data.localAuction ? formatMoney(data.localAuction.currentBidCents) : '$5.00'}</span></div>
                        <div class="flex items-center justify-between"><span class="text-gray-300">Regional Spotlight</span><span class="font-bold text-[#FFCB67]">${data.regionalAuction ? formatMoney(data.regionalAuction.currentBidCents) : '$25.00'}</span></div>
                        <div class="pt-3 border-t border-white/10 text-sm text-gray-400">Use the advertise page to see the live auction status and next steps.</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
`;
