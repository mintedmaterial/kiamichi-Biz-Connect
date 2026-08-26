import { describe, expect, it } from 'vitest';
import { chicagoAuctionDay, chicagoAuctionStart, decideBid, openingBidCents } from '../auction';

describe('sponsored auction rules', () => {
  it('accepts only a strictly higher first-price bid', () => {
    expect(decideBid(500, 500, 500)).toMatchObject({ accepted: false, reason: 'not_high_enough', winningBidCents: 500 });
    expect(decideBid(500, 501, 500)).toMatchObject({ accepted: true, winningBidCents: 501 });
  });

  it('rejects bids below the configured tier floor', () => {
    expect(decideBid(0, 499, 500)).toMatchObject({ accepted: false, reason: 'below_floor', winningBidCents: 0 });
  });

  it('uses the prior 24-hour winning average and clamps to the floor', () => {
    const now = 1_000_000;
    expect(openingBidCents([
      { winningBidCents: 500, settledAt: now - 100 },
      { winningBidCents: 1_000, settledAt: now - 200 }
    ], 500, now)).toBe(800);
    expect(openingBidCents([{ winningBidCents: 100, settledAt: now - 100 }], 500, now)).toBe(500);
  });

  it('ignores stale, malformed, and future history without producing NaN', () => {
    const now = 1_000_000;
    expect(openingBidCents([
      { winningBidCents: 0, settledAt: now - 1 },
      { winningBidCents: Number.NaN, settledAt: now - 2 },
      { winningBidCents: 10_000, settledAt: now - 90_000 },
      { winningBidCents: 50_000, settledAt: now + 1 }
    ], 500, now)).toBe(500);
  });

  it('uses the prior Chicago auction day until the 07:00 local reset', () => {
    const beforeReset = Math.floor(Date.parse('2026-08-27T10:00:00Z') / 1000); // 05:00 CDT
    const activeStart = chicagoAuctionStart(beforeReset) - 24 * 60 * 60;
    expect(chicagoAuctionDay(activeStart)).toBe('2026-08-26');
  });
});
