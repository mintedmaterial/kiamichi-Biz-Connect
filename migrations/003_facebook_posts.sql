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
