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
