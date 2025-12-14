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
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header-dark sticky top-0 z-50">
        <nav class="container mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
                <a href="/" class="flex items-center">
                    <img src="/logo.png" alt="${env.SITE_NAME}" class="h-20 md:h-24 w-auto">
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
                    <img src="/logo.png" alt="${env.SITE_NAME}" class="h-24 w-auto mb-4">
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
            <a href="/submit" class="btn-glow text-white px-8 py-4 rounded-lg font-semibold text-lg inline-block">
                List Your Business Today
            </a>
        </div>
    </section>
`;
