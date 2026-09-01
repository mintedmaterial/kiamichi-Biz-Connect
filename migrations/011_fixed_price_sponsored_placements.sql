-- Fixed-price sponsored placements replace public bidding terminology.
-- Existing auction history remains intact for audit; new checkouts use the tables below.

CREATE TABLE IF NOT EXISTS sponsored_placement_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier_id TEXT NOT NULL,
  business_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('checkout_pending', 'paid', 'checkout_failed', 'manual_refund_required')),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  setup_token TEXT,
  ad_placement_id INTEGER,
  FOREIGN KEY (tier_id) REFERENCES sponsored_auction_tiers(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (ad_placement_id) REFERENCES ad_placements(id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_placement_purchases_status
  ON sponsored_placement_purchases(tier_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsored_placement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  provider_event_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (purchase_id) REFERENCES sponsored_placement_purchases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_placement_events_purchase
  ON sponsored_placement_events(purchase_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsored_placement_creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  body_text TEXT NOT NULL,
  offer_text TEXT,
  cta_label TEXT NOT NULL,
  cta_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  image_url TEXT,
  image_key TEXT,
  FOREIGN KEY (purchase_id) REFERENCES sponsored_placement_purchases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_placement_creatives_purchase
  ON sponsored_placement_creatives(purchase_id);
