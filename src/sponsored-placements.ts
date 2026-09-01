import { DatabaseService } from './database';
import type { Env, SponsoredAuctionTier } from './types';
import { verifySquareWebhookSignature } from './square-auctions';

const GUARANTEE_SECONDS = 60 * 60;

interface SquarePayment {
  id?: string;
  status?: string;
  order_id?: string;
  reference_id?: string;
  amount_money?: { amount?: number };
}

interface SquareWebhookEnvelope {
  event_id?: string;
  type?: string;
  data?: { object?: { payment?: SquarePayment } };
}

interface SquareOrderMetadata {
  sponsored_purchase_id?: string;
}

interface PurchaseRow {
  id: number;
  tier_id: string;
  business_id: number;
  amount_cents: number;
  status: 'checkout_pending' | 'paid' | 'checkout_failed' | 'manual_refund_required';
  provider_order_id: string | null;
  setup_token: string | null;
  ad_placement_id: number | null;
}

interface PlacementCreative {
  headline: string;
  body_text: string;
  offer_text: string | null;
  cta_label: string;
  cta_url: string | null;
  image_url: string | null;
  image_key: string | null;
}

export interface SponsoredPlacementStatus {
  tier: SponsoredAuctionTier;
  priceCents: number;
  takeoverPriceCents: number;
  isAvailable: boolean;
  guaranteedUntil: number | null;
  activeBusinessId: number | null;
}

export interface SponsoredPlacementCheckoutRequest {
  tierId: string;
  businessId: number;
}

function squareApiBaseUrl(env: Env): string {
  return env.SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

function placementType(tier: SponsoredAuctionTier): string {
  return tier.placement_type === 'sponsored' ? 'sidebar' : tier.placement_type;
}

export function isSquareCheckoutConfigured(env: Env): boolean {
  return Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);
}

async function getTier(db: D1Database, tierId: string): Promise<SponsoredAuctionTier | null> {
  return db.prepare(`
    SELECT id, label, placement_type, floor_cents, is_active
    FROM sponsored_auction_tiers
    WHERE id = ? AND is_active = 1
  `).bind(tierId).first<SponsoredAuctionTier>();
}

async function getActivePlacement(
  db: D1Database,
  tier: SponsoredAuctionTier,
  now: number
): Promise<{ business_id: number; end_date: number } | null> {
  return db.prepare(`
    SELECT business_id, end_date
    FROM ad_placements
    WHERE placement_type = ? AND is_active = 1 AND end_date > ?
    ORDER BY end_date DESC
    LIMIT 1
  `).bind(placementType(tier), now).first<{ business_id: number; end_date: number }>();
}

async function hasPreviousPlacement(db: D1Database, tier: SponsoredAuctionTier): Promise<boolean> {
  const prior = await db.prepare(`
    SELECT 1 AS present
    FROM ad_placements
    WHERE placement_type = ?
    LIMIT 1
  `).bind(placementType(tier)).first<{ present: number }>();
  return Boolean(prior?.present);
}

export async function getSponsoredPlacementStatus(
  db: D1Database,
  tierId: string,
  now = Math.floor(Date.now() / 1000)
): Promise<SponsoredPlacementStatus | null> {
  const tier = await getTier(db, tierId);
  if (!tier) return null;
  const active = await getActivePlacement(db, tier, now);
  const hadPriorPlacement = active ? true : await hasPreviousPlacement(db, tier);
  const takeoverPriceCents = tier.floor_cents === 500 ? 600 : tier.floor_cents + 100;
  return {
    tier,
    priceCents: active ? takeoverPriceCents : (hadPriorPlacement ? takeoverPriceCents : tier.floor_cents),
    takeoverPriceCents,
    isAvailable: !active,
    guaranteedUntil: active?.end_date ?? null,
    activeBusinessId: active?.business_id ?? null
  };
}

async function createSquarePaymentLink(
  env: Env,
  params: { purchaseId: number; setupToken: string; tier: SponsoredAuctionTier; businessName: string; amountCents: number }
): Promise<{ checkoutUrl: string | null; orderId: string | null }> {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) return { checkoutUrl: null, orderId: null };

  const response = await fetch(`${squareApiBaseUrl(env)}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: env.SQUARE_LOCATION_ID,
        reference_id: `kbc-sponsored-placement-${params.purchaseId}`,
        metadata: { sponsored_purchase_id: String(params.purchaseId) },
        line_items: [{
          name: `${params.tier.label} sponsored placement`,
          quantity: '1',
          base_price_money: { amount: params.amountCents, currency: 'USD' }
        }]
      },
      checkout_options: {
        redirect_url: `${env.SITE_URL}/advertise/setup?purchase=${params.purchaseId}&token=${encodeURIComponent(params.setupToken)}`
      }
    })
  });

  if (!response.ok) {
    console.warn('Square sponsored-placement link creation failed', response.status);
    return { checkoutUrl: null, orderId: null };
  }

  const payload = await response.json() as { payment_link?: { url?: string; order_id?: string } };
  return { checkoutUrl: payload.payment_link?.url || null, orderId: payload.payment_link?.order_id || null };
}

export async function createSponsoredPlacementCheckout(
  db: DatabaseService,
  env: Env,
  input: SponsoredPlacementCheckoutRequest
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isSquareCheckoutConfigured(env)) {
    return { status: 503, body: { error: 'Sponsored placement checkout is not configured yet.' } };
  }

  const tier = await getTier(db.db, input.tierId);
  if (!tier) return { status: 404, body: { error: 'Sponsored placement tier not found.' } };
  const business = await db.getBusinessByIdIncludingInactive(input.businessId);
  if (!business) return { status: 404, body: { error: 'Business not found.' } };

  const now = Math.floor(Date.now() / 1000);
  const active = await getActivePlacement(db.db, tier, now);
  if (active) {
    return {
      status: 409,
      body: {
        error: 'This placement is still in its guaranteed hour.',
        guaranteedUntil: active.end_date,
        takeoverPriceCents: tier.floor_cents === 500 ? 600 : tier.floor_cents + 100
      }
    };
  }

  const amountCents = (await hasPreviousPlacement(db.db, tier))
    ? (tier.floor_cents === 500 ? 600 : tier.floor_cents + 100)
    : tier.floor_cents;
  const setupToken = crypto.randomUUID();
  const inserted = await db.db.prepare(`
    INSERT INTO sponsored_placement_purchases (tier_id, business_id, amount_cents, status, setup_token)
    VALUES (?, ?, ?, 'checkout_pending', ?)
  `).bind(tier.id, business.id, amountCents, setupToken).run();
  const purchaseId = Number(inserted.meta.last_row_id || 0);
  if (!purchaseId) return { status: 500, body: { error: 'Could not start sponsored placement checkout.' } };

  const paymentLink = await createSquarePaymentLink(env, { purchaseId, setupToken, tier, businessName: business.name, amountCents });
  if (!paymentLink.checkoutUrl || !paymentLink.orderId) {
    await db.db.prepare(`UPDATE sponsored_placement_purchases SET status = 'checkout_failed' WHERE id = ?`).bind(purchaseId).run();
    return { status: 502, body: { error: 'Could not start Square checkout. Please try again.' } };
  }

  await db.db.prepare(`
    UPDATE sponsored_placement_purchases SET provider_order_id = ? WHERE id = ?
  `).bind(paymentLink.orderId, purchaseId).run();

  return {
    status: 201,
    body: {
      purchaseId,
      tierId: tier.id,
      amountCents,
      paymentStatus: 'checkout_pending',
      checkoutUrl: paymentLink.checkoutUrl,
      orderId: paymentLink.orderId
    }
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
    INSERT OR IGNORE INTO square_webhook_events (event_id, event_type, payment_id, order_id, raw_body, processed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(eventId, eventType, paymentId, orderId, rawBody, now).run();
  return (result.meta.changes || 0) > 0;
}

async function fetchSquareOrderMetadata(env: Env, orderId: string): Promise<SquareOrderMetadata> {
  if (!env.SQUARE_ACCESS_TOKEN) return {};
  const response = await fetch(`${squareApiBaseUrl(env)}/v2/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}` }
  });
  if (!response.ok) return {};
  const payload = await response.json() as { order?: { metadata?: SquareOrderMetadata } };
  return payload.order?.metadata || {};
}

export async function handleSponsoredPlacementSquareWebhook(
  db: DatabaseService,
  env: Env,
  request: Request
): Promise<Response> {
  const rawBody = await request.text();
  let event: SquareWebhookEnvelope;
  try {
    event = JSON.parse(rawBody) as SquareWebhookEnvelope;
  } catch {
    return Response.json({ error: 'Invalid Square webhook JSON' }, { status: 400 });
  }

  if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL) {
    return Response.json({ error: 'Square webhook signature configuration is missing.' }, { status: 503 });
  }
  if (!(await verifySquareWebhookSignature(env.SQUARE_WEBHOOK_URL, rawBody, env.SQUARE_WEBHOOK_SIGNATURE_KEY, request))) {
    return Response.json({ error: 'Invalid Square webhook signature' }, { status: 401 });
  }

  const payment = event.data?.object?.payment;
  const eventId = event.event_id;
  const eventType = event.type || 'unknown';
  if (!eventId) return Response.json({ error: 'Square event_id missing' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const stored = await ensureSquareWebhookEvent(db, eventId, eventType, payment?.id || null, payment?.order_id || null, rawBody, now);
  if (!stored) return Response.json({ ok: true, duplicate: true, eventId });
  if (eventType !== 'payment.updated' || payment?.status?.toUpperCase() !== 'COMPLETED' || !payment.order_id) {
    return Response.json({ ok: true, ignored: true, eventId });
  }

  const metadata = await fetchSquareOrderMetadata(env, payment.order_id);
  const purchaseId = Number(metadata.sponsored_purchase_id || 0);
  const purchase = Number.isSafeInteger(purchaseId) && purchaseId > 0
    ? await db.db.prepare(`SELECT id, tier_id, business_id, amount_cents, status, provider_order_id, setup_token, ad_placement_id FROM sponsored_placement_purchases WHERE id = ?`).bind(purchaseId).first<PurchaseRow>()
    : await db.db.prepare(`SELECT id, tier_id, business_id, amount_cents, status, provider_order_id, setup_token, ad_placement_id FROM sponsored_placement_purchases WHERE provider_order_id = ?`).bind(payment.order_id).first<PurchaseRow>();
  if (!purchase) return Response.json({ ok: true, ignored: true, reason: 'purchase-not-found', eventId });
  if (payment.amount_money?.amount !== purchase.amount_cents) {
    await db.db.prepare(`UPDATE sponsored_placement_purchases SET status = 'manual_refund_required', provider_payment_id = ? WHERE id = ?`).bind(payment.id || null, purchase.id).run();
    return Response.json({ ok: true, activated: false, reason: 'payment-mismatch', eventId });
  }

  const tier = await getTier(db.db, purchase.tier_id);
  if (!tier) return Response.json({ ok: true, activated: false, reason: 'tier-not-found', eventId });
  const existing = await getActivePlacement(db.db, tier, now);
  if (existing) {
    await db.db.prepare(`UPDATE sponsored_placement_purchases SET status = 'manual_refund_required', provider_payment_id = ? WHERE id = ?`).bind(payment.id || null, purchase.id).run();
    return Response.json({ ok: true, activated: false, reason: 'placement-already-guaranteed', eventId });
  }

  const endDate = now + GUARANTEE_SECONDS;
  const activation = await db.db.batch([
    db.db.prepare(`
      INSERT INTO ad_placements (business_id, placement_type, position, start_date, end_date, is_active, price_paid)
      SELECT ?, ?, NULL, ?, ?, 1, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM ad_placements
        WHERE placement_type = ? AND is_active = 1 AND end_date > ?
      )
    `).bind(
      purchase.business_id,
      placementType(tier),
      now,
      endDate,
      purchase.amount_cents / 100,
      placementType(tier),
      now
    )
  ]);

  const placementId = Number(activation[0]?.meta.last_row_id || 0);
  if (!placementId) {
    await db.db.prepare(`UPDATE sponsored_placement_purchases SET status = 'manual_refund_required', provider_payment_id = ? WHERE id = ?`)
      .bind(payment.id || null, purchase.id).run();
    return Response.json({ ok: true, activated: false, reason: 'placement-already-guaranteed', eventId });
  }
  await db.db.batch([
    db.db.prepare(`UPDATE sponsored_placement_purchases SET status = 'paid', provider_payment_id = ?, ad_placement_id = ? WHERE id = ?`)
      .bind(payment.id || null, placementId, purchase.id),
    db.db.prepare(`INSERT INTO sponsored_placement_events (purchase_id, event_type, amount_cents, provider_event_id) VALUES (?, 'payment_completed', ?, ?)`)
      .bind(purchase.id, purchase.amount_cents, payment.id || null)
  ]);

  return Response.json({ ok: true, activated: true, eventId, purchaseId: purchase.id, guaranteedUntil: endDate });
}

export async function getSponsoredPlacementSetup(db: D1Database, purchaseId: number, setupToken: string): Promise<(PurchaseRow & { business_name: string; creative: PlacementCreative | null }) | null> {
  const row = await db.prepare(`
    SELECT p.id, p.tier_id, p.business_id, p.amount_cents, p.status, p.provider_order_id, p.setup_token, p.ad_placement_id,
      b.name AS business_name,
      c.headline, c.body_text, c.offer_text, c.cta_label, c.cta_url, c.image_url, c.image_key
    FROM sponsored_placement_purchases p
    INNER JOIN businesses b ON b.id = p.business_id
    LEFT JOIN sponsored_placement_creatives c ON c.purchase_id = p.id
    WHERE p.id = ? AND p.setup_token = ?
  `).bind(purchaseId, setupToken).first<PurchaseRow & { business_name: string } & Partial<PlacementCreative>>();
  if (!row) return null;
  const creative = row.headline && row.body_text && row.cta_label
    ? { headline: row.headline, body_text: row.body_text, offer_text: row.offer_text || null, cta_label: row.cta_label, cta_url: row.cta_url || null, image_url: row.image_url || null, image_key: row.image_key || null }
    : null;
  return { ...row, creative };
}

export async function saveSponsoredPlacementCreative(
  db: D1Database,
  purchaseId: number,
  setupToken: string,
  creative: PlacementCreative
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const setup = await getSponsoredPlacementSetup(db, purchaseId, setupToken);
  if (!setup) return { ok: false, status: 404, error: 'Placement setup link not found.' };
  if (setup.status === 'checkout_failed' || setup.status === 'manual_refund_required') {
    return { ok: false, status: 409, error: 'This placement cannot be published. Please contact support.' };
  }
  await db.prepare(`
    INSERT INTO sponsored_placement_creatives (purchase_id, headline, body_text, offer_text, cta_label, cta_url, image_url, image_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(purchase_id) DO UPDATE SET
      headline = excluded.headline, body_text = excluded.body_text, offer_text = excluded.offer_text,
      cta_label = excluded.cta_label, cta_url = excluded.cta_url,
      image_url = COALESCE(excluded.image_url, sponsored_placement_creatives.image_url),
      image_key = COALESCE(excluded.image_key, sponsored_placement_creatives.image_key), updated_at = unixepoch()
  `).bind(purchaseId, creative.headline, creative.body_text, creative.offer_text, creative.cta_label, creative.cta_url, creative.image_url, creative.image_key).run();
  return { ok: true };
}
