export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE: KVNamespace;
  AI: Ai;
  SITE_NAME: string;
  SITE_URL: string;
  DEFAULT_SERVICE_AREA: string;
  ADMIN_EMAIL: string;
  ADMIN_KEY: string;
  ENVIRONMENT: string;
  // Optional Facebook integration secrets (set via wrangler secrets)
  FB_GROUP_ID?: string;
  FB_ACCESS_TOKEN?: string;
  FB_APP_ID?: string;
  FB_APP_SECRET?: string;
  FB_API_VERSION?: string;
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
  service_area: string | null;
  facebook_url: string | null;
  google_business_url: string | null;
  image_url: string | null;
  google_rating: number;
  google_review_count: number;
  facebook_rating: number;
  facebook_review_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  facebook_page_id: string | null;
  last_facebook_enrichment: number | null;
  facebook_enrichment_status: string | null;
  facebook_enrichment_error: string | null;
  facebook_post_count: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parent_id: number | null;
  display_order: number;
  created_at: number;
}

export interface AdPlacement {
  id: number;
  business_id: number;
  placement_type: 'homepage-featured' | 'category-top' | 'sidebar' | 'sponsored';
  position: number | null;
  start_date: number;
  end_date: number;
  is_active: boolean;
  price_paid: number | null;
  created_at: number;
}

export interface BlogPost {
  id: number;
  business_id: number | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image: string | null;
  author: string;
  is_published: boolean;
  publish_date: number | null;
  created_at: number;
  updated_at: number;
}

export interface BusinessSubmission {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  category_id: number | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  submission_data: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: number;
  processed_at: number | null;
}

export interface SearchParams {
  query?: string;
  category?: string;
  city?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface FacebookPost {
  id: number;
  business_id: number;
  post_id: string;
  post_url: string;
  message: string | null;
  created_time: string;
  embed_code: string;
  ai_quality_score: number;
  relevance_tags: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: number;
}

export interface PostAnalysisResult {
  quality_score: number;
  relevance_tags: string[];
  reasoning: string;
}
