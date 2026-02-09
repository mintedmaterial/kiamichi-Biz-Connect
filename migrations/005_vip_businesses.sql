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
