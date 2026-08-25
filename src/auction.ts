export interface AuctionTier {
  id: string;
  label: string;
  placementType: string;
  floorCents: number;
}

export interface BidHistory {
  winningBidCents: number;
  settledAt: number;
}

export interface AuctionState {
  tierId: string;
  auctionDay: string;
  hourStart: number;
  currentBidCents: number;
  currentBusinessId: number | null;
}

export interface BidDecision {
  accepted: boolean;
  reason: 'accepted' | 'not_high_enough' | 'below_floor' | 'invalid_amount';
  winningBidCents: number;
}

/** First-price rule: a valid strictly higher bid takes the active slot. */
export function decideBid(
  currentBidCents: number,
  bidCents: number,
  floorCents: number
): BidDecision {
  if (!Number.isSafeInteger(bidCents) || bidCents <= 0) {
    return { accepted: false, reason: 'invalid_amount', winningBidCents: currentBidCents };
  }
  if (bidCents < floorCents) {
    return { accepted: false, reason: 'below_floor', winningBidCents: currentBidCents };
  }
  if (bidCents <= currentBidCents) {
    return { accepted: false, reason: 'not_high_enough', winningBidCents: currentBidCents };
  }
  return { accepted: true, reason: 'accepted', winningBidCents: bidCents };
}

/** Average prior winning bids, rounded up to whole dollars and never below floor. */
export function openingBidCents(
  history: BidHistory[],
  floorCents: number,
  now: number,
  windowSeconds = 24 * 60 * 60
): number {
  const cutoff = now - windowSeconds;
  const recent = history.filter(
    (entry) =>
      Number.isSafeInteger(entry.winningBidCents) &&
      entry.winningBidCents > 0 &&
      Number.isFinite(entry.settledAt) &&
      entry.settledAt >= cutoff &&
      entry.settledAt <= now
  );
  if (recent.length === 0) return floorCents;
  const average = recent.reduce((sum, entry) => sum + entry.winningBidCents, 0) / recent.length;
  return Math.max(floorCents, Math.ceil(average / 100) * 100);
}

/** Stable America/Chicago daily key without relying on server-local timezone. */
export function chicagoAuctionDay(timestampSeconds: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestampSeconds * 1000));
}

export function currentAuctionHourStart(timestampSeconds: number): number {
  const dayStart = chicagoAuctionStart(timestampSeconds);
  const anchor = timestampSeconds >= dayStart ? dayStart : chicagoAuctionStart(timestampSeconds - 24 * 60 * 60);
  return anchor + Math.floor((timestampSeconds - anchor) / 3600) * 3600;
}

/** The daily reset occurs at 07:00 America/Chicago. */
export function chicagoAuctionStart(timestampSeconds: number): number {
  const day = chicagoAuctionDay(timestampSeconds);
  const parts = day.split('-').map(Number);
  const probe = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 13, 0, 0));
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    timeZoneName: 'short'
  }).formatToParts(probe);
  const zone = formatted.find((part) => part.type === 'timeZoneName')?.value;
  const offsetHours = zone === 'CDT' ? 5 : 6;
  return Math.floor(probe.getTime() / 1000) + (offsetHours - 6) * 60 * 60;
}
