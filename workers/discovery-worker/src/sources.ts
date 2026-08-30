import { BusinessCandidate, DiscoverySource, Env, Target } from './types';

const YELP_SEARCH_URL = 'https://api.yelp.com/v3/businesses/search';
const FACEBOOK_SEARCH_URL = 'https://graph.facebook.com/v20.0/search';

export async function discoverFromYelp(target: Target, env: Env): Promise<BusinessCandidate[]> {
  if (!env.YELP_API_KEY) {
    console.warn('Yelp discovery skipped: YELP_API_KEY is not configured');
    return [];
  }

  const url = new URL(YELP_SEARCH_URL);
  url.searchParams.set('term', target.categoryName);
  url.searchParams.set('location', `${target.city}, ${target.state}`);
  url.searchParams.set('limit', '10');
  url.searchParams.set('sort_by', 'rating');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.YELP_API_KEY}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Yelp search failed: ${response.status}`);
  }

  const payload = await response.json<YelpSearchResponse>();
  return (payload.businesses ?? []).map((business) => ({
    source: 'yelp' as const,
    sourceId: business.id,
    name: business.name,
    rating: business.rating,
    reviewCount: business.review_count,
    phone: business.display_phone || business.phone || null,
    website: null,
    facebookUrl: null,
    address: business.location.display_address?.join(', ') || null,
    city: business.location.city || target.city,
    state: normalizeState(business.location.state) ?? target.state,
    zipCode: business.location.zip_code || null,
    latitude: business.coordinates?.latitude ?? null,
    longitude: business.coordinates?.longitude ?? null,
    categories: business.categories.map((category) => category.title),
    sourceUrl: business.url || null,
    evidence: { yelp: business },
  }));
}

export async function discoverFromFacebook(target: Target, env: Env): Promise<BusinessCandidate[]> {
  if (!env.FB_ACCESS_TOKEN) {
    console.warn('Facebook discovery skipped: FB_ACCESS_TOKEN is not configured');
    return [];
  }

  const url = new URL(FACEBOOK_SEARCH_URL);
  url.searchParams.set('type', 'place');
  url.searchParams.set('q', `${target.categoryName} in ${target.city} ${target.state}`);
  url.searchParams.set('fields', 'id,name,location,overall_star_rating,rating_count,phone,website,link,category_list');
  url.searchParams.set('limit', '10');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.FB_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    // Page/place search availability depends on the app's granted permissions.
    // A source failure must not prevent Yelp candidates from being verified.
    console.warn(`Facebook discovery skipped: ${response.status}`);
    return [];
  }

  const payload = await response.json<FacebookSearchResponse>();
  return (payload.data ?? []).flatMap((business) => {
    const state = normalizeState(business.location?.state);
    if (!state || !business.location?.city || !business.overall_star_rating) return [];

    return [{
      source: 'facebook' as const,
      sourceId: business.id,
      name: business.name,
      rating: business.overall_star_rating,
      reviewCount: business.rating_count ?? 0,
      phone: business.phone || null,
      website: business.website || null,
      facebookUrl: business.link || null,
      address: [business.location.street, business.location.city, business.location.state, business.location.zip]
        .filter(Boolean)
        .join(', ') || null,
      city: business.location.city,
      state,
      zipCode: business.location.zip || null,
      latitude: null,
      longitude: null,
      categories: business.category_list?.map((category) => category.name) ?? [],
      sourceUrl: business.link || null,
      evidence: { facebook: business },
    }];
  });
}

export function filterCandidates(candidates: BusinessCandidate[], env: Env): BusinessCandidate[] {
  const minimumRating = Number(env.MINIMUM_RATING);
  const minimumReviewCount = Number(env.MINIMUM_REVIEW_COUNT);
  return candidates.filter((candidate) =>
    candidate.rating >= minimumRating &&
    candidate.reviewCount >= minimumReviewCount &&
    ['OK', 'TX', 'AR'].includes(candidate.state),
  );
}

function normalizeState(value: string | undefined): 'OK' | 'TX' | 'AR' | null {
  const normalized = value?.trim().toUpperCase();
  if (normalized === 'OK' || normalized === 'OKLAHOMA') return 'OK';
  if (normalized === 'TX' || normalized === 'TEXAS') return 'TX';
  if (normalized === 'AR' || normalized === 'ARKANSAS') return 'AR';
  return null;
}

interface YelpSearchResponse {
  businesses?: YelpBusiness[];
}

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  phone?: string;
  display_phone?: string;
  url?: string;
  coordinates?: { latitude?: number; longitude?: number };
  categories: Array<{ title: string }>;
  location: { display_address?: string[]; city?: string; state?: string; zip_code?: string };
}

interface FacebookSearchResponse {
  data?: FacebookPlace[];
}

interface FacebookPlace {
  id: string;
  name: string;
  overall_star_rating?: number;
  rating_count?: number;
  phone?: string;
  website?: string;
  link?: string;
  location?: { city?: string; state?: string; street?: string; zip?: string };
  category_list?: Array<{ name: string }>;
}
