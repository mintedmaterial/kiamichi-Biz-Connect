-- GENERATED FILE. Numbered migrations are the source of truth.
-- Run `npm run schema:generate` after adding a migration.

-- BEGIN migrations/001_initial_schema.sql
-- Baseline schema for replaying the numbered migration chain.
-- This is the pre-Facebook/pre-featured/pre-VIP schema formerly kept only in schema.sql.

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    parent_id INTEGER,
    display_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category_id INTEGER NOT NULL,
    email TEXT,
    phone TEXT,
    website TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT,
    latitude REAL,
    longitude REAL,
    service_area TEXT,
    facebook_url TEXT,
    google_business_url TEXT,
    image_url TEXT,
    google_rating REAL DEFAULT 0,
    google_review_count INTEGER DEFAULT 0,
    facebook_rating REAL DEFAULT 0,
    facebook_review_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    is_featured BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS ad_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    placement_type TEXT NOT NULL,
    position INTEGER,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    price_paid REAL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS business_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    category_id INTEGER,
    description TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    website TEXT,
    submission_data TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER
);

CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    author TEXT DEFAULT 'KiamichiBizConnect',
    is_published BOOLEAN DEFAULT 0,
    publish_date INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS blog_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_post_id INTEGER NOT NULL,
    image_key TEXT NOT NULL,
    image_prompt TEXT,
    display_order INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_keywords (
    business_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id),
    PRIMARY KEY (business_id, keyword)
);

INSERT INTO categories (name, slug, description, icon) VALUES
('Home Services', 'home-services', 'Contractors, electricians, plumbers, and more', '🏠'),
('Beauty & Personal Care', 'beauty-personal-care', 'Hair salons, barbershops, spas, and nail salons', '💇'),
('Professional Services', 'professional-services', 'Legal, accounting, consulting, and business services', '💼'),
('Automotive', 'automotive', 'Auto repair, detailing, towing, and car sales', '🚗'),
('Health & Wellness', 'health-wellness', 'Medical, dental, fitness, and wellness services', '🏥'),
('Food & Dining', 'food-dining', 'Restaurants, catering, food trucks, and bakeries', '🍴'),
('Retail', 'retail', 'Stores, boutiques, and specialty shops', '🛍️'),
('Education & Training', 'education-training', 'Schools, tutoring, training centers', '📚'),
('Entertainment & Events', 'entertainment-events', 'Event planning, photographers, DJs, and venues', '🎉'),
('Real Estate', 'real-estate', 'Realtors, property management, and home builders', '🏡');

CREATE INDEX IF NOT EXISTS idx_blog_images_post ON blog_images(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_images_approved ON blog_images(blog_post_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_is_featured ON businesses(is_featured);
CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON businesses(is_active);
CREATE INDEX IF NOT EXISTS idx_ad_placements_active ON ad_placements(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, publish_date);
-- END migrations/001_initial_schema.sql

-- BEGIN migrations/002_shared_worker_tables.sql
-- Shared main-Worker service tables not present in the original schema baseline.

CREATE TABLE IF NOT EXISTS business_claim_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_method TEXT NOT NULL DEFAULT 'manual_review',
    admin_notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    reviewed_at INTEGER,
    reviewed_by TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    service_requested TEXT,
    message TEXT,
    urgency TEXT DEFAULT 'medium',
    preferred_contact_method TEXT DEFAULT 'email',
    status TEXT DEFAULT 'new',
    forwarded_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    tier TEXT DEFAULT 'free',
    auto_forward_email TEXT,
    notification_email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    completeness_score INTEGER DEFAULT 0,
    missing_fields TEXT,
    suggestions TEXT,
    found_data TEXT,
    confidence_scores TEXT,
    analysis_date INTEGER DEFAULT (unixepoch()),
    analyzer_version TEXT DEFAULT 'v1.0',
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrichment_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    current_value TEXT,
    suggested_value TEXT,
    confidence REAL,
    source_url TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    reviewed_at INTEGER,
    reviewed_by TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS advertiser_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    plan TEXT NOT NULL DEFAULT 'auction-only',
    contact_email TEXT NOT NULL,
    advertised_name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_claim_requests_business
ON business_claim_requests(business_id, requester_email, status);
CREATE INDEX IF NOT EXISTS idx_contact_leads_business
ON contact_leads(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_analysis_business
ON business_analysis(business_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_suggestions_business
ON enrichment_suggestions(business_id, status);
-- END migrations/002_shared_worker_tables.sql

-- BEGIN migrations/003_facebook_posts.sql
-- Facebook posts table for enrichment
CREATE TABLE IF NOT EXISTS facebook_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    post_id TEXT NOT NULL UNIQUE,
    post_url TEXT NOT NULL,
    message TEXT,
    created_time TEXT,
    embed_code TEXT NOT NULL,
    ai_quality_score INTEGER DEFAULT 0,
    relevance_tags TEXT, -- JSON array
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Add Facebook enrichment columns to businesses
ALTER TABLE businesses ADD COLUMN facebook_page_id TEXT;
ALTER TABLE businesses ADD COLUMN last_facebook_enrichment INTEGER;
ALTER TABLE businesses ADD COLUMN facebook_enrichment_status TEXT DEFAULT 'pending';
ALTER TABLE businesses ADD COLUMN facebook_enrichment_error TEXT;
ALTER TABLE businesses ADD COLUMN facebook_post_count INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facebook_posts_business ON facebook_posts(business_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_quality ON facebook_posts(ai_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_facebook_page ON businesses(facebook_page_id);
CREATE INDEX IF NOT EXISTS idx_businesses_enrichment_status ON businesses(facebook_enrichment_status);
-- END migrations/003_facebook_posts.sql

-- BEGIN migrations/004_featured_rotation.sql
-- Featured Rotation System
-- Migration 004: Add tables for automated featured business rotation
-- Created: 2025-02-09 by DevFlo

-- Track featured rotation history (audit log)
CREATE TABLE IF NOT EXISTS featured_rotation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    featured_start INTEGER NOT NULL,  -- Unix timestamp when featured
    featured_end INTEGER,              -- Unix timestamp when unfeatured (NULL = currently featured)
    rotation_reason TEXT,              -- 'scheduled', 'manual', 'ad_placement'
    slot_position INTEGER,             -- Which slot they were in (1-6)
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Featured slots configuration (6 slots by default)
CREATE TABLE IF NOT EXISTS featured_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_position INTEGER NOT NULL UNIQUE,  -- 1, 2, 3, 4, 5, 6
    business_id INTEGER,                     -- Current business in slot (NULL = empty)
    priority_source TEXT DEFAULT 'rotation', -- 'rotation', 'ad', 'manual'
    rotation_interval_days INTEGER DEFAULT 7,
    last_rotated INTEGER,                    -- Unix timestamp of last rotation
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);

-- Initialize 6 featured slots (display slots on homepage)
INSERT OR IGNORE INTO featured_slots (slot_position, priority_source) VALUES
    (1, 'rotation'),
    (2, 'rotation'),
    (3, 'rotation'),
    (4, 'rotation'),
    (5, 'rotation'),
    (6, 'rotation');

-- Featured tier table: businesses eligible for featured rotation (future paid tier).
-- Membership is operational data and must be assigned by stable business records, not seeded IDs.
CREATE TABLE IF NOT EXISTS featured_tier_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    tier_level TEXT DEFAULT 'free',          -- 'free', 'basic', 'premium'
    tier_start INTEGER DEFAULT (unixepoch()),
    tier_end INTEGER,                         -- NULL = active, timestamp = expired
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_featured_tier_business ON featured_tier_members(business_id);
CREATE INDEX IF NOT EXISTS idx_featured_tier_active ON featured_tier_members(tier_end);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_featured_rotation_business ON featured_rotation_log(business_id);
CREATE INDEX IF NOT EXISTS idx_featured_rotation_active ON featured_rotation_log(featured_end);
CREATE INDEX IF NOT EXISTS idx_featured_rotation_dates ON featured_rotation_log(featured_start, featured_end);
CREATE INDEX IF NOT EXISTS idx_featured_slots_business ON featured_slots(business_id);
-- END migrations/004_featured_rotation.sql

-- BEGIN migrations/005_vip_businesses.sql
-- VIP/Family Businesses Configuration
-- Migration 005: Add table for VIP businesses that get daily automated posts
-- Created: 2025-02-09 by DevFlo

-- VIP businesses get special treatment:
-- - Daily unique posts (different angle each day)
-- - Higher frequency than regular featured businesses
-- - Tracked post history to avoid repeats

CREATE TABLE IF NOT EXISTS vip_businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    vip_type TEXT DEFAULT 'family',           -- 'family', 'sponsor', 'partner'
    post_frequency TEXT DEFAULT 'daily',      -- 'daily', 'weekly', 'bi-weekly'
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Track what angles/topics have been used for each VIP business
CREATE TABLE IF NOT EXISTS vip_post_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    post_angle TEXT NOT NULL,                  -- 'services', 'testimonial', 'seasonal', 'promotion', 'new_product', 'behind_scenes', 'team', 'community'
    post_content_hash TEXT,                    -- Hash to detect duplicates
    posted_at INTEGER DEFAULT (unixepoch()),
    post_id TEXT,                              -- Facebook post ID
    had_mascot BOOLEAN DEFAULT 0,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Available post angles for variety
CREATE TABLE IF NOT EXISTS post_angle_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    angle_name TEXT NOT NULL UNIQUE,
    prompt_template TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1
);

-- Seed post angle templates
INSERT OR IGNORE INTO post_angle_templates (angle_name, prompt_template, description) VALUES
    ('services', 'Highlight the key services offered by {business_name}. Focus on what makes their {service_type} stand out in {city}.', 'Feature main services'),
    ('testimonial', 'Create a post about customer experiences at {business_name}. Use a warm, appreciative tone about {city} locals.', 'Customer appreciation'),
    ('seasonal', 'Create a seasonal/timely post for {business_name}. Consider current events, holidays, or weather in {city}, OK.', 'Seasonal relevance'),
    ('promotion', 'Create an engaging promotional post for {business_name}. Highlight any special offers or value they provide.', 'Promotional content'),
    ('new_product', 'Feature something new or exciting at {business_name}. Could be a new service, product, or capability.', 'New offerings'),
    ('behind_scenes', 'Give a behind-the-scenes look at {business_name}. Show the people, process, or passion behind the work.', 'Behind the scenes'),
    ('team', 'Spotlight the team at {business_name}. Celebrate the people who make the business special in {city}.', 'Team spotlight'),
    ('community', 'Highlight how {business_name} supports the {city} community. Show their local involvement and impact.', 'Community connection');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vip_businesses_business ON vip_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_vip_post_history_business ON vip_post_history(business_id);
CREATE INDEX IF NOT EXISTS idx_vip_post_history_angle ON vip_post_history(business_id, post_angle);
CREATE INDEX IF NOT EXISTS idx_vip_post_history_date ON vip_post_history(posted_at);

-- NOTE: After running this migration, add VIP businesses with:
-- INSERT INTO vip_businesses (business_id, vip_type, notes) VALUES
--   (XXX, 'family', 'Velvet Fringe Salon'),
--   (YYY, 'family', 'Twisted Custom Leather');
-- (Replace XXX and YYY with actual business IDs from the businesses table)
-- END migrations/005_vip_businesses.sql

-- BEGIN migrations/006_business_agent.sql
-- Business Agent ownership, draft-page, publication, and audit tables.

CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT,
    user_picture TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER,
    last_activity INTEGER
);
CREATE TABLE IF NOT EXISTS site_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS business_owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS business_ownership (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    business_id INTEGER NOT NULL,
    claim_status TEXT NOT NULL DEFAULT 'pending',
    verified_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES business_owners(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS portal_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    picture TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS portal_sessions (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    expires_at INTEGER,
    last_activity INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES portal_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS listing_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    layout_version TEXT NOT NULL DEFAULT 'v1',
    is_published INTEGER DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    seo_keywords TEXT,
    draft_updated_at INTEGER DEFAULT (unixepoch()),
    last_published_at INTEGER,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS page_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_page_id INTEGER NOT NULL,
    component_type TEXT NOT NULL,
    style_variant TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    content TEXT,
    config TEXT,
    is_visible INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (listing_page_id) REFERENCES listing_pages(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS page_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_page_id INTEGER NOT NULL,
    snapshot_type TEXT NOT NULL DEFAULT 'pre_publish',
    components_json TEXT,
    snapshot_data TEXT,
    metadata TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    created_by_owner_id INTEGER,
    created_by TEXT,
    snapshot_label TEXT,
    FOREIGN KEY (listing_page_id) REFERENCES listing_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_owner_id) REFERENCES business_owners(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS published_pages_r2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_page_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    html_hash TEXT NOT NULL,
    published_at INTEGER DEFAULT (unixepoch()),
    published_by_owner_id INTEGER,
    snapshot_id INTEGER,
    file_size_bytes INTEGER,
    FOREIGN KEY (listing_page_id) REFERENCES listing_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (published_by_owner_id) REFERENCES business_owners(id) ON DELETE SET NULL,
    FOREIGN KEY (snapshot_id) REFERENCES page_snapshots(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS portal_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    business_id INTEGER,
    activity_type TEXT NOT NULL,
    activity_data TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES business_owners(id) ON DELETE SET NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS atlas_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    task_name TEXT,
    task_id TEXT,
    subagent_id TEXT,
    subagent_label TEXT,
    parent_task_id TEXT,
    message TEXT,
    metadata TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_listing_pages_business ON listing_pages(business_id);
CREATE INDEX IF NOT EXISTS idx_page_components_listing_page ON page_components(listing_page_id, display_order);
CREATE INDEX IF NOT EXISTS idx_page_snapshots_listing_page ON page_snapshots(listing_page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_pages_listing_page ON published_pages_r2(listing_page_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_activity_owner ON portal_activity_log(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_activity_created ON atlas_activity(created_at DESC);
-- END migrations/006_business_agent.sql

-- BEGIN migrations/009_ad_placement_auction_tier.sql
-- Link paid placements to their fixed-price tier definition.
ALTER TABLE ad_placements ADD COLUMN auction_tier_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_placements_auction_tier
ON ad_placements(auction_tier_id);
-- END migrations/009_ad_placement_auction_tier.sql

-- BEGIN migrations/010_sponsored_auctions.sql
-- Sponsored placement auctions and published custom-page eligibility.
-- Apply with the normal versioned D1 migration command.

CREATE TABLE IF NOT EXISTS sponsored_auction_tiers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  placement_type TEXT NOT NULL,
  floor_cents INTEGER NOT NULL CHECK (floor_cents > 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO sponsored_auction_tiers (id, label, placement_type, floor_cents)
VALUES
  ('local-spotlight', 'Local Spotlight', 'homepage-featured', 500),
  ('regional-spotlight', 'Regional Spotlight', 'sponsored', 2500);

CREATE TABLE IF NOT EXISTS sponsored_auction_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier_id TEXT NOT NULL,
  auction_day TEXT NOT NULL,
  hour_start INTEGER NOT NULL,
  opening_bid_cents INTEGER NOT NULL,
  winning_bid_cents INTEGER NOT NULL,
  winning_business_id INTEGER,
  settled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (tier_id) REFERENCES sponsored_auction_tiers(id),
  FOREIGN KEY (winning_business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  UNIQUE (tier_id, auction_day, hour_start)
);

CREATE TABLE IF NOT EXISTS sponsored_auction_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_hour_id INTEGER NOT NULL,
  tier_id TEXT NOT NULL,
  business_id INTEGER NOT NULL,
  bid_cents INTEGER NOT NULL CHECK (bid_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  rejection_reason TEXT,
  provider TEXT NOT NULL DEFAULT 'pending-square',
  provider_payment_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (auction_hour_id) REFERENCES sponsored_auction_hours(id) ON DELETE CASCADE,
  FOREIGN KEY (tier_id) REFERENCES sponsored_auction_tiers(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_hours_tier_time
  ON sponsored_auction_hours(tier_id, auction_day, hour_start);
CREATE INDEX IF NOT EXISTS idx_sponsored_bids_hour
  ON sponsored_auction_bids(auction_hour_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsored_bids_history
  ON sponsored_auction_hours(tier_id, settled_at DESC);

-- Square event IDs are idempotency keys for webhook delivery. Keep the
-- payload for operational audit, but never log it or expose this table.
CREATE TABLE IF NOT EXISTS square_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT,
  raw_body TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_square_webhook_events_payment
  ON square_webhook_events(payment_id);

-- The business-agent already owns this table in newer deployments. Keep this
-- guarded for clean environments and use published_pages_r2 as the allowlist.
CREATE TABLE IF NOT EXISTS published_pages_r2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_page_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  html_hash TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  snapshot_id INTEGER,
  file_size_bytes INTEGER,
  FOREIGN KEY (listing_page_id) REFERENCES listing_pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_published_pages_r2_listing
  ON published_pages_r2(listing_page_id, published_at DESC);
-- END migrations/010_sponsored_auctions.sql
