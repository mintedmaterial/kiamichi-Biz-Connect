import { BusinessCandidate, Enrichment, Env, Target, VerificationResult } from './types';

interface CityRow { city: string; state: string }
interface CategoryRow { name: string }

export async function selectNextTarget(env: Env): Promise<Target> {
  const [citiesResult, categoriesResult] = await Promise.all([
    env.DB.prepare(`
      SELECT DISTINCT TRIM(city) AS city,
        CASE UPPER(TRIM(state))
          WHEN 'OK' THEN 'OK' WHEN 'OKLAHOMA' THEN 'OK'
          WHEN 'TX' THEN 'TX' WHEN 'TEXAS' THEN 'TX'
          WHEN 'AR' THEN 'AR' WHEN 'ARKANSAS' THEN 'AR'
        END AS state
      FROM businesses
      WHERE TRIM(city) <> ''
        AND UPPER(TRIM(state)) IN ('OK', 'OKLAHOMA', 'TX', 'TEXAS', 'AR', 'ARKANSAS')
      ORDER BY city, state
    `).all<CityRow>(),
    env.DB.prepare('SELECT name FROM categories ORDER BY display_order, name').all<CategoryRow>(),
  ]);
  const cities = citiesResult.results ?? [];
  const categories = categoriesResult.results ?? [];
  if (cities.length === 0 || categories.length === 0) {
    throw new Error('Cannot select a discovery target without existing cities and categories');
  }

  const indexKey = 'discovery:target-index';
  const index = Number(await env.CACHE.get(indexKey) ?? '0');
  const target: Target = {
    city: cities[index % cities.length].city,
    state: cities[index % cities.length].state as Target['state'],
    categoryName: categories[Math.floor(index / cities.length) % categories.length].name,
  };
  await env.CACHE.put(indexKey, String(index + 1));
  return target;
}

export async function isKnownBusiness(candidate: BusinessCandidate, env: Env): Promise<boolean> {
  const normalizedName = normalizeName(candidate.name);
  const normalizedPhone = normalizePhone(candidate.phone);
  const existing = await env.DB.prepare(`
    SELECT 1 FROM businesses
    WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(name, '.', ''), ',', ''), '''', ''), ' ', '')) = ?
      AND LOWER(TRIM(city)) = LOWER(?)
      AND CASE UPPER(TRIM(state))
        WHEN 'OKLAHOMA' THEN 'OK' WHEN 'TEXAS' THEN 'TX' WHEN 'ARKANSAS' THEN 'AR' ELSE UPPER(TRIM(state))
      END = ?
    UNION ALL
    SELECT 1 FROM business_submissions
    WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(name, '.', ''), ',', ''), '''', ''), ' ', '')) = ?
      AND LOWER(TRIM(city)) = LOWER(?)
      AND CASE UPPER(TRIM(state))
        WHEN 'OKLAHOMA' THEN 'OK' WHEN 'TEXAS' THEN 'TX' WHEN 'ARKANSAS' THEN 'AR' ELSE UPPER(TRIM(state))
      END = ?
    LIMIT 1
  `).bind(normalizedName, candidate.city, candidate.state, normalizedName, candidate.city, candidate.state).first();
  if (existing) return true;

  if (!normalizedPhone) return false;
  return Boolean(await env.DB.prepare(`
    SELECT 1 FROM businesses WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
    UNION ALL
    SELECT 1 FROM business_submissions WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
    LIMIT 1
  `).bind(normalizedPhone, normalizedPhone).first());
}

export async function createSubmission(
  candidate: BusinessCandidate,
  categoryId: number,
  enrichment: Enrichment,
  verification: VerificationResult,
  confidence: number,
  env: Env,
): Promise<number> {
  const submissionData = {
    ...candidate,
    email: '',
    facebook_url: candidate.facebookUrl,
    address_line1: candidate.address,
    zip_code: candidate.zipCode,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    google_rating: candidate.source === 'yelp' ? candidate.rating : null,
    google_review_count: candidate.source === 'yelp' ? candidate.reviewCount : null,
    facebook_rating: candidate.source === 'facebook' ? candidate.rating : null,
    facebook_review_count: candidate.source === 'facebook' ? candidate.reviewCount : null,
    discovery: { enrichment, verification, confidence },
  };
  const result = await env.DB.prepare(`
    INSERT INTO business_submissions (
      name, email, phone, category_id, description, address, city, state, website, submission_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    candidate.name, '', candidate.phone, categoryId,
    String(enrichment.description ?? ''), candidate.address, candidate.city, candidate.state,
    candidate.website, JSON.stringify(submissionData),
  ).run();
  return Number(result.meta.last_row_id);
}

export async function getCategoryId(slug: string, env: Env): Promise<number | null> {
  const result = await env.DB.prepare('SELECT id FROM categories WHERE slug = ?').bind(slug).first<{ id: number }>();
  return result?.id ?? null;
}

export async function logOutcome(
  candidate: BusinessCandidate,
  outcome: string,
  confidence: number | null,
  evidence: Record<string, unknown>,
  env: Env,
  submissionId?: number,
): Promise<void> {
  const runDate = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO discovery_log (
      run_date, source, source_id, candidate_name, candidate_city, candidate_state,
      rating, review_count, outcome, confidence, submission_id, evidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    runDate, candidate.source, candidate.sourceId, candidate.name, candidate.city, candidate.state,
    candidate.rating, candidate.reviewCount, outcome, confidence, submissionId ?? null, JSON.stringify(evidence),
  ).run();
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[.,'\s]/g, '').trim();
}

function normalizePhone(value: string | null): string | null {
  const normalized = value?.replace(/\D/g, '') ?? '';
  return normalized.length >= 10 ? normalized.slice(-10) : null;
}
