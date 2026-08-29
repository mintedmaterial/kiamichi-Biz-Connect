export type DiscoverySource = 'yelp' | 'facebook';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Env {
  AI: Ai;
  CACHE: KVNamespace;
  DB: D1Database;
  FLAGS: Flagship;
  DISCOVERY_QUEUE: Queue<BusinessCandidate>;
  DISCOVERY_WORKFLOW: Workflow;
  VERIFICATION_WORKFLOW: Workflow;
  VERIFIER: Fetcher;
  ADMIN_KEY?: string;
  DISCOVERY_ENABLED: string;
  FB_ACCESS_TOKEN?: string;
  MAX_DAILY_DISCOVERIES: string;
  MINIMUM_RATING: string;
  MINIMUM_REVIEW_COUNT: string;
  VERIFIER_SHARED_SECRET?: string;
  YELP_API_KEY?: string;
}

export interface Target {
  categoryName: string;
  city: string;
  state: 'OK' | 'TX' | 'AR';
}

export interface BusinessCandidate {
  source: DiscoverySource;
  sourceId: string;
  name: string;
  rating: number;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  facebookUrl: string | null;
  address: string | null;
  city: string;
  state: 'OK' | 'TX' | 'AR';
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
  sourceUrl: string | null;
  evidence: Record<string, any>;
}

export interface Enrichment {
  categorySlug: string;
  description: string;
  serviceArea: string[];
  keywords: string[];
  confidence: number;
  reasoning: string;
}

export interface VerificationResult {
  verdict: 'approve' | 'review' | 'reject';
  confidence: number;
  discrepancies: string[];
  reasoning: string;
}
