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
