export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE: KVNamespace;
  AI: Ai;
  // LOADER: WorkerLoader;  // Code Mode: Uncomment when beta access granted
  SITE_NAME: string;
  SITE_URL: string;
  MAIN_WORKER_URL: string;
  ANALYZER_VERSION: string;
  MAX_AUTO_UPDATES_PER_DAY: string;
  AUTO_APPLY_CONFIDENCE_THRESHOLD: string;
  USE_CODE_MODE?: string;  // Set to "true" to enable Code Mode execution
  ADMIN_KEY?: string;  // For /test-cron endpoint auth
}

export interface Business {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category_id: number;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  review_count: number | null;
  image_url: string | null;
  facebook_url: string | null;
  facebook_image_url: string | null;
  hours: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: number;
  updated_at: number;
}

export interface AnalysisResult {
  businessId: number;
  completenessScore: number;
  missingFields: string[];
  suggestions: EnrichmentSuggestion[];
  foundData: Record<string, any>;
  confidenceScores: Record<string, number>;
}

export interface EnrichmentSuggestion {
  field: string;
  currentValue: string | null;
  suggestedValue: string;
  confidence: number;
  source: string;
  sourceType: string;
  reasoning: string;
}

export interface AnalyzeRequest {
  businessId: number;
  mode: 'manual' | 'auto';
  adminEmail?: string; // For manual mode
}

export interface AnalyzeResponse {
  success: boolean;
  businessId: number;
  mode: string;
  completenessScore?: number;
  suggestionsCount?: number;
  autoAppliedCount?: number;
  error?: string;
}
