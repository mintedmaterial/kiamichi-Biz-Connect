import { decideBid } from './auction';
import { getAuctionStatus } from './auction-service';
import { DatabaseService } from './database';
import type { Env, SponsoredAuctionTier } from './types';

interface SquareMoney {
  amount?: number;
  currency?: string;
}

interface SquarePaymentObject {
  id?: string;
  status?: string;
  amount_money?: SquareMoney;
  order_id?: string;
  reference_id?: string;
  note?: string;
}

interface SquareWebhookEnvelope {
  event_id?: string;
  id?: string;
  event_type?: string;
  type?: string;
  data?: {
    id?: string;
    type?: string;
    object?: {
      payment?: SquarePaymentObject;
    };
    payment?: SquarePaymentObject;
  };
}

export interface SquareAuctionBidRequest {
  tierId: string;
  businessId: number;
  bidCents: number;
}

export interface SquareAuctionBidResponse {
  bidId: number;
  auctionHourId: number;
  tierId: string;
  businessId: number;
  bidCents: number;
  auctionDay: string;
  hourStart: number;
  paymentStatus: 'pending-square';
  checkoutUrl: string | null;
  orderId: string | null;
  paymentLinkId: string | null;
}

interface SquareBidRow {
  id: number;
  auction_hour_id: number;
  tier_id: string;
  business_id: number;
  bid_cents: number;
  status: 'accepted' | 'rejected';
  rejection_reason: string | null;
  provider: string;
  provider_payment_id: string | null;
  created_at: number;
}

interface SquareOrderMetadata {
  bid_id?: string;
  tier_id?: string;
  business_id?: string;
  bid_cents?: string;
  auction_day?: string;
  hour_start?: string;
  placement_type?: string;
}

interface SquarePaymentLinkResponse {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  paymentLink?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  order?: {
    id?: string;
  };
}

function squareApiBaseUrl(env: Env): string {
  return env.SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

export function isSquareCheckoutConfigured(env: Env): boolean {
  return Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getWebhookSignature(request: Request): string | null {
  return (
    request.headers.get('x-square-hmacsha256-signature') ||
    request.headers.get('X-Square-Hmacsha256-Signature') ||
    request.headers.get('x-square-signature')
  );
}

export async function verifySquareWebhookSignature(
  notificationUrl: string,
  rawBody: string,
  signatureKey: string,
  request: Request
): Promise<boolean> {
  const signature = getWebhookSignature(request);
  if (!signature) return false;
  const expected = await hmacSha256Base64(signatureKey, `${notificationUrl}${rawBody}`);
  return constantTimeEqual(signature, expected);
}

function extractPayment(event: SquareWebhookEnvelope): SquarePaymentObject | null {
  return event.data?.object?.payment || event.data?.payment || null;
}

function normalizeAuctionDayHour(now: number, status: Awaited<ReturnType<typeof getAuctionStatus>>) {
  return {
    auctionDay: status?.auctionDay ?? '',
    hourStart: status?.currentHour ?? Math.floor(now / 3600) * 3600
  };
}

async function fetchSquareOrderMetadata(env: Env, orderId: string): Promise<SquareOrderMetadata> {
  if (!env.SQUARE_ACCESS_TOKEN) return {};
  const response = await fetch(`${squareApiBaseUrl(env)}/v2/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) return {};
  const payload = await response.json() as { order?: { metadata?: SquareOrderMetadata; reference_id?: string } };
  return payload.order?.metadata || {};
}

async function createSquarePaymentLink(
  env: Env,
  params: {
    bidId: number;
    tierId: string;
    tierLabel: string;
    businessId: number;
    businessName: string;
    bidCents: number;
    auctionDay: string;
    hourStart: number;
    placementType: string;
  }
): Promise<{ checkoutUrl: string | null; orderId: string | null; paymentLinkId: string | null }> {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
    return { checkoutUrl: null, orderId: null, paymentLinkId: null };
  }

  const body = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: env.SQUARE_LOCATION_ID,
      reference_id: `kbc-bid-${params.bidId}`,
      metadata: {
        bid_id: String(params.bidId),
        tier_id: params.tierId,
        business_id: String(params.businessId),
        bid_cents: String(params.bidCents),
        auction_day: params.auctionDay,
        hour_start: String(params.hourStart),
        placement_type: params.placementType
      },
      line_items: [
        {
          name: `${params.tierLabel} sponsored placement`,
          quantity: '1',
          base_price_money: {
            amount: params.bidCents,
            currency: 'USD'
          }
        }
      ]
    },
    checkout_options: {
      redirect_url: `${env.SITE_URL}/advertise?bid=${params.bidId}&paid=1`
    }
  };

  const response = await fetch(`${squareApiBaseUrl(env)}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn('Square payment link creation failed', response.status, text);
    return { checkoutUrl: null, orderId: null, paymentLinkId: null };
  }

  const payload = await response.json() as SquarePaymentLinkResponse;
  const paymentLink = payload.payment_link || payload.paymentLink || {};
  return {
    checkoutUrl: paymentLink.url || null,
    orderId: paymentLink.order_id || payload.order?.id || null,
    paymentLinkId: paymentLink.id || null
  };
}

async function ensureSquareWebhookEvent(
  db: DatabaseService,
  eventId: string,
  eventType: string,
  paymentId: string | null,
  orderId: string | null,
  rawBody: string,
  now: number
): Promise<boolean> {
  const result = await db.db.prepare(`
    INSERT OR IGNORE INTO square_webhook_events (
      event_id, event_type, payment_id, order_id, raw_body, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(eventId, eventType, paymentId, orderId, rawBody, now).run();
  return (result.meta.changes || 0) > 0;
}

async function loadBidForWebhook(
  db: DatabaseService,
  metadata: SquareOrderMetadata,
  paymentId: string | null,
  orderId: string | null,
  paymentAmount: number | null
): Promise<SquareBidRow | null> {
  const bidId = Number(metadata.bid_id || 0);
  if (Number.isSafeInteger(bidId) && bidId > 0) {
    const row = await db.db.prepare(`
      SELECT * FROM sponsored_auction_bids WHERE id = ?
    `).bind(bidId).first<SquareBidRow>();
    if (row) return row;
  }

  if (orderId) {
    const row = await db.db.prepare(`
      SELECT * FROM sponsored_auction_bids
      WHERE provider_payment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(orderId).first<SquareBidRow>();
    if (row) return row;
  }

  if (paymentId) {
    const row = await db.db.prepare(`
      SELECT * FROM sponsored_auction_bids
      WHERE provider_payment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(paymentId).first<SquareBidRow>();
    if (row) return row;
  }

  if (metadata.tier_id && metadata.business_id && Number.isFinite(paymentAmount || NaN)) {
    const row = await db.db.prepare(`
      SELECT * FROM sponsored_auction_bids
      WHERE tier_id = ? AND business_id = ? AND bid_cents = ? AND status = 'accepted'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(metadata.tier_id, Number(metadata.business_id), paymentAmount || 0).first<SquareBidRow>();
    if (row) return row;
  }

  return null;
}

async function upsertAuctionWinner(
  db: DatabaseService,
  row: SquareBidRow,
  payment: SquarePaymentObject,
  now: number,
  tier: SponsoredAuctionTier,
  placementType: string
): Promise<boolean> {
  const startDate = now;
  const endDate = startDate + 60 * 60;

  const current = await db.db.prepare(`
    SELECT winning_bid_cents FROM sponsored_auction_hours WHERE id = ?
  `).bind(row.auction_hour_id).first<{ winning_bid_cents: number }>();

  if (current && row.bid_cents <= current.winning_bid_cents) {
    await db.db.batch([
      db.db.prepare(`
        UPDATE sponsored_auction_bids
        SET provider = ?, provider_payment_id = ?, status = 'rejected', rejection_reason = 'outbid_before_payment'
        WHERE id = ?
      `).bind('square', payment.id || payment.order_id || null, row.id),
      db.db.prepare(`
        INSERT INTO auction_bid_events (bid_id, event_type, amount_cents, provider_event_id)
        VALUES (?, 'outbid', ?, ?)
      `).bind(row.id, row.bid_cents, payment.id || payment.order_id || null)
    ]);
    return false;
  }

  await db.db.batch([
    db.db.prepare(`
      UPDATE sponsored_auction_bids
      SET provider = ?, provider_payment_id = ?, status = 'accepted', rejection_reason = NULL
      WHERE id = ?
    `).bind('square', payment.id || payment.order_id || null, row.id),
    db.db.prepare(`
      UPDATE sponsored_auction_hours
      SET winning_bid_cents = ?, winning_business_id = ?, settled_at = COALESCE(settled_at, ?)
      WHERE id = ?
    `).bind(row.bid_cents, row.business_id, now, row.auction_hour_id),
    db.db.prepare(`
      UPDATE ad_placements
      SET is_active = 0
      WHERE placement_type = ? AND is_active = 1
    `).bind(placementType),
    db.db.prepare(`
      INSERT INTO ad_placements (
        business_id, placement_type, position, start_date, end_date, is_active, price_paid
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).bind(row.business_id, placementType, null, startDate, endDate, row.bid_cents / 100),
    db.db.prepare(`
      INSERT INTO auction_bid_events (bid_id, event_type, amount_cents, provider_event_id)
      VALUES (?, 'payment_completed', ?, ?)
    `).bind(row.id, row.bid_cents, payment.id || payment.order_id || null)
  ]);

  console.log('Activated sponsored auction placement', {
    tierId: tier.id,
    placementType,
    businessId: row.business_id,
    bidId: row.id,
    amount: row.bid_cents
  });
  return true;
}

export async function createSponsoredAuctionBid(
  db: DatabaseService,
  env: Env,
  input: SquareAuctionBidRequest
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isSquareCheckoutConfigured(env)) {
    return {
      status: 503,
      body: { error: 'Auction checkout is not configured yet. Please try again after Square setup is complete.' }
    };
  }
  const tier = await db.db.prepare(`
    SELECT id, label, placement_type, floor_cents, is_active
    FROM sponsored_auction_tiers
    WHERE id = ? AND is_active = 1
  `).bind(input.tierId).first<SponsoredAuctionTier>();

  if (!tier) {
    return { status: 404, body: { error: 'Auction tier not found' } };
  }

  const business = await db.getBusinessByIdIncludingInactive(input.businessId);
  if (!business) {
    return { status: 404, body: { error: 'Business not found' } };
  }

  const now = Math.floor(Date.now() / 1000);
  const status = await getAuctionStatus(db.db, input.tierId, now);
  if (!status) {
    return { status: 404, body: { error: 'Auction status unavailable' } };
  }

  const decision = decideBid(status.currentBidCents, input.bidCents, tier.floor_cents);
  if (!decision.accepted) {
    return {
      status: 409,
      body: {
        error: 'Bid was not accepted',
        reason: decision.reason,
        currentBidCents: status.currentBidCents,
        floorCents: tier.floor_cents
      }
    };
  }

  const auctionDay = status.auctionDay;
  const hourStart = status.currentHour;

  await db.db.prepare(`
    INSERT INTO sponsored_auction_hours (
      tier_id, auction_day, hour_start, opening_bid_cents, winning_bid_cents, winning_business_id, settled_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(tier_id, auction_day, hour_start)
    DO NOTHING
  `).bind(
    input.tierId,
    auctionDay,
    hourStart,
    status.openingBidCents,
    status.openingBidCents,
    null
  ).run();

  const auctionHour = await db.db.prepare(`
    SELECT id FROM sponsored_auction_hours
    WHERE tier_id = ? AND auction_day = ? AND hour_start = ?
  `).bind(input.tierId, auctionDay, hourStart).first<{ id: number }>();

  if (!auctionHour) {
    return { status: 500, body: { error: 'Could not create auction hour' } };
  }

  const bidInsert = await db.db.prepare(`
    INSERT INTO sponsored_auction_bids (
      auction_hour_id, tier_id, business_id, bid_cents, status, rejection_reason, provider, provider_payment_id
    ) VALUES (?, ?, ?, ?, 'accepted', NULL, 'pending-square', NULL)
  `).bind(
    auctionHour.id,
    input.tierId,
    input.businessId,
    input.bidCents
  ).run();

  const bidId = Number(bidInsert.meta.last_row_id || 0);
  const paymentLink = await createSquarePaymentLink(env, {
    bidId,
    tierId: input.tierId,
    tierLabel: tier.label,
    businessId: input.businessId,
    businessName: business.name,
    bidCents: input.bidCents,
    auctionDay,
    hourStart,
    placementType: tier.placement_type === 'sponsored' ? 'sidebar' : tier.placement_type
  });

  if (paymentLink.orderId) {
    await db.db.prepare(`
      UPDATE sponsored_auction_bids
      SET provider_payment_id = ?
      WHERE id = ?
    `).bind(paymentLink.orderId, bidId).run();
  }

  return {
    status: 201,
    body: {
      bidId,
      auctionHourId: auctionHour.id,
      tierId: input.tierId,
      businessId: input.businessId,
      bidCents: input.bidCents,
      auctionDay,
      hourStart,
      paymentStatus: 'pending-square' as const,
      checkoutUrl: paymentLink.checkoutUrl,
      orderId: paymentLink.orderId,
      paymentLinkId: paymentLink.paymentLinkId
    }
  };
}

export async function handleSquareWebhook(
  db: DatabaseService,
  env: Env,
  request: Request
): Promise<Response> {
  const rawBody = await request.text();
  let parsed: SquareWebhookEnvelope;
  try {
    parsed = JSON.parse(rawBody) as SquareWebhookEnvelope;
  } catch {
    return Response.json({ error: 'Invalid Square webhook JSON' }, { status: 400 });
  }

  const eventId = parsed.event_id || parsed.id || parsed.data?.id || parsed.data?.object?.payment?.id;
  const eventType = parsed.event_type || parsed.type || parsed.data?.type || 'unknown';
  const payment = extractPayment(parsed);
  const paymentId = payment?.id || parsed.data?.id || null;
  const orderId = payment?.order_id || null;

  if (!eventId) {
    return Response.json({ error: 'Square event_id missing' }, { status: 400 });
  }

  if (env.SQUARE_WEBHOOK_SIGNATURE_KEY && env.SQUARE_WEBHOOK_URL) {
    const verified = await verifySquareWebhookSignature(env.SQUARE_WEBHOOK_URL, rawBody, env.SQUARE_WEBHOOK_SIGNATURE_KEY, request);
    if (!verified) {
      return Response.json({ error: 'Invalid Square webhook signature' }, { status: 401 });
    }
  } else if (env.ENVIRONMENT === 'production') {
    return Response.json({ error: 'Square webhook signature key is not configured' }, { status: 503 });
  }

  const now = Math.floor(Date.now() / 1000);
  const stored = await ensureSquareWebhookEvent(db, eventId, eventType, paymentId, orderId, rawBody, now);
  if (!stored) {
    return Response.json({ ok: true, duplicate: true, eventId }, { status: 200 });
  }

  if (eventType !== 'payment.updated' || !payment) {
    return Response.json({ ok: true, ignored: true, eventType, eventId }, { status: 200 });
  }

  if ((payment.status || '').toUpperCase() !== 'COMPLETED') {
    return Response.json({ ok: true, ignored: true, eventType, eventId, paymentStatus: payment.status }, { status: 200 });
  }

  const paymentAmount = payment.amount_money?.amount ?? null;
  const orderMetadata = orderId ? await fetchSquareOrderMetadata(env, orderId) : {};
  const metadata: SquareOrderMetadata = {
    ...orderMetadata,
    bid_id: orderMetadata.bid_id || payment.reference_id?.replace(/^kbc-bid-/, '') || undefined,
    placement_type: orderMetadata.placement_type || undefined
  };

  const bid = await loadBidForWebhook(db, metadata, paymentId, orderId, paymentAmount);
  if (!bid) {
    return Response.json({ ok: true, ignored: true, reason: 'bid-not-found', eventId }, { status: 200 });
  }

  const expectedAmount = Number(metadata.bid_cents || bid.bid_cents || 0);
  if (Number.isFinite(paymentAmount ?? NaN) && paymentAmount !== expectedAmount) {
    await db.db.prepare(`
      UPDATE sponsored_auction_bids
      SET status = 'rejected', rejection_reason = 'payment_mismatch', provider = 'square', provider_payment_id = ?
      WHERE id = ?
    `).bind(paymentId || orderId, bid.id).run();

    return Response.json({ ok: true, ignored: true, reason: 'payment-mismatch', eventId }, { status: 200 });
  }

  const tier = await db.db.prepare(`
    SELECT id, label, placement_type, floor_cents, is_active
    FROM sponsored_auction_tiers
    WHERE id = ?
  `).bind(bid.tier_id).first<SponsoredAuctionTier>();

  if (!tier) {
    return Response.json({ ok: true, ignored: true, reason: 'tier-not-found', eventId }, { status: 200 });
  }

  const placementType = tier.placement_type === 'sponsored' ? 'sidebar' : tier.placement_type;
  const activated = await upsertAuctionWinner(db, bid, payment, now, tier, placementType);

  return Response.json({
    ok: true,
    activated,
    eventId,
    paymentId,
    orderId,
    bidId: bid.id,
    tierId: bid.tier_id,
    businessId: bid.business_id,
    placementType
  }, { status: 200 });
}
