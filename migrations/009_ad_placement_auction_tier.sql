-- Link paid placements to their fixed-price tier definition.
ALTER TABLE ad_placements ADD COLUMN auction_tier_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_placements_auction_tier
ON ad_placements(auction_tier_id);
