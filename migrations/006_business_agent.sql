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
