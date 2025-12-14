-- Categories table for business types
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

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category_id INTEGER NOT NULL,
    
    -- Contact Information
    email TEXT,
    phone TEXT,
    website TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT,
    
    -- Location for search
    latitude REAL,
    longitude REAL,
    service_area TEXT, -- JSON array of cities/regions served
    
    -- Social Media & Online Presence
    facebook_url TEXT,
    google_business_url TEXT,
    image_url TEXT,
    
    -- Reviews and Ratings
    google_rating REAL DEFAULT 0,
    google_review_count INTEGER DEFAULT 0,
    facebook_rating REAL DEFAULT 0,
    facebook_review_count INTEGER DEFAULT 0,
    
    -- Business Status
    is_verified BOOLEAN DEFAULT 0,
    is_featured BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Ad placements table
CREATE TABLE IF NOT EXISTS ad_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    placement_type TEXT NOT NULL, -- 'homepage-featured', 'category-top', 'sidebar', 'sponsored'
    position INTEGER,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    price_paid REAL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Business submissions (pending approval)
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
    submission_data TEXT, -- JSON with all submitted data
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER
);

-- Blog posts for featured businesses
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

-- Blog images table for AI-generated candidate images
CREATE TABLE IF NOT EXISTS blog_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_post_id INTEGER NOT NULL,
    image_key TEXT NOT NULL,           -- R2 storage key (e.g., 'blog/slug-timestamp-1.png')
    image_prompt TEXT,                 -- AI prompt used to generate this image
    display_order INTEGER DEFAULT 0,   -- Order for display (1, 2, 3)
    is_approved BOOLEAN DEFAULT 0,     -- Admin has approved this image
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blog_images_post ON blog_images(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_images_approved ON blog_images(blog_post_id, is_approved);

-- Search keywords for better discoverability
CREATE TABLE IF NOT EXISTS business_keywords (
    business_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id),
    PRIMARY KEY (business_id, keyword)
);

-- Insert default categories
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_is_featured ON businesses(is_featured);
CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON businesses(is_active);
CREATE INDEX IF NOT EXISTS idx_ad_placements_active ON ad_placements(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, publish_date);
