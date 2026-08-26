import { openingBidCents, chicagoAuctionDay, chicagoAuctionStart } from './auction';
import type { SponsoredAuctionTier } from './types';

export interface AuctionStatus {
  tier: SponsoredAuctionTier;
  auctionDay: string;
  currentHour: number;
  openingBidCents: number;
  currentBidCents: number;
  currentBusinessId: number | null;
  paymentStatus: 'pending-square';
}

export async function getAuctionStatus(
  db: D1Database,
  tierId: string,
  now = Math.floor(Date.now() / 1000)
): Promise<AuctionStatus | null> {
  const tier = await db.prepare(`
    SELECT id, label, placement_type, floor_cents, is_active
    FROM sponsored_auction_tiers
    WHERE id = ? AND is_active = 1
  `).bind(tierId).first<SponsoredAuctionTier>();
  if (!tier) return null;

  const todayStart = chicagoAuctionStart(now);
  // The 07:00 Chicago reset defines both the active 24-hour window and its
  // stable auction-day key. Before 07:00, that window started yesterday.
  const currentHour = now < todayStart ? todayStart - 24 * 60 * 60 : todayStart;
  const auctionDay = chicagoAuctionDay(currentHour);
  const current = await db.prepare(`
    SELECT hour_start, opening_bid_cents, winning_bid_cents, winning_business_id
    FROM sponsored_auction_hours
    WHERE tier_id = ? AND auction_day = ? AND hour_start = ?
  `).bind(tierId, auctionDay, currentHour).first<{
    hour_start: number;
    opening_bid_cents: number;
    winning_bid_cents: number;
    winning_business_id: number | null;
  }>();

  const history = await db.prepare(`
    SELECT winning_bid_cents, settled_at
    FROM sponsored_auction_hours
    WHERE tier_id = ? AND settled_at IS NOT NULL AND settled_at >= ? AND settled_at <= ?
  `).bind(tierId, now - 24 * 60 * 60, now).all<{ winning_bid_cents: number; settled_at: number }>();
  const opening = openingBidCents(
    (history.results || []).map((entry) => ({ winningBidCents: entry.winning_bid_cents, settledAt: entry.settled_at })),
    tier.floor_cents,
    now
  );
  const normalizedTier = tier.placement_type === 'sponsored'
    ? { ...tier, placement_type: 'sidebar' }
    : tier;

  return {
    tier: normalizedTier,
    auctionDay,
    currentHour,
    openingBidCents: current?.opening_bid_cents ?? opening,
    currentBidCents: current?.winning_bid_cents ?? opening,
    currentBusinessId: current?.winning_business_id ?? null,
    paymentStatus: 'pending-square'
  };
}
