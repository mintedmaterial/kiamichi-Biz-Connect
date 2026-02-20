export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket; // kiamichi-biz-images - AI-generated social/blog content
  BUSINESS_IMAGES: R2Bucket; // kiamichi-business-images - User-generated business listing images
  BUSINESS_ASSETS: R2Bucket; // kiamichi-business-assets - Published static HTML pages
  TEMPLATES: R2Bucket; // kiamichi-component-templates - Page component templates
  CACHE: KVNamespace;
  AI: Ai; // Includes Workers AI and AI Search (autorag)
  ANALYZER: Fetcher; // Service binding to analyzer worker
  SITE_NAME: string;
  SITE_URL: string;
  DEFAULT_SERVICE_AREA: string;
  ADMIN_EMAIL: string;
  ADMIN_KEY: string; // Deprecated - will be replaced by Google OAuth
  ENVIRONMENT: string;

  // Google OAuth for admin authentication
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ADMIN_GOOGLE_EMAILS: string; // Comma-separated list of authorized emails

  // GitHub OAuth for admin authentication
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  // Facebook OAuth for business integration
  FACEBOOK_APP_ID: string;
  FACEBOOK_APP_SECRET: string;

  // Optional Facebook integration secrets (deprecated - will use OAuth tokens)
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

export interface BlogImage {
  id: number;
  blog_post_id: number;
  image_key: string;
  image_prompt: string | null;
  display_order: number;
  is_approved: boolean;
  created_at: number;
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

// Facebook Automated Posting System Interfaces

export interface FacebookContentQueue {
  id: number;
  content_type: 'business_spotlight' | 'blog_share' | 'category_highlight' | 'engagement_prompt';
  target_type: 'page' | 'group' | 'both';
  business_id: number | null;
  blog_post_id: number | null;
  category_id: number | null;
  message: string;
  link: string | null;
  image_url: string | null;
  scheduled_for: number; // Unix timestamp
  status: 'pending' | 'posted' | 'failed';
  priority: number; // 1-10, higher = more important
  content_hash: string | null; // For deduplication
  created_at: number;
  posted_at: number | null;
  error_message: string | null;
  page_post_id: string | null; // Facebook post ID for Page
  group_post_id: string | null; // Facebook post ID for Group
}

export interface FacebookPostAnalytics {
  id: number;
  queue_id: number;
  post_id: string; // Facebook post ID
  target_type: 'page' | 'group';
  impressions: number;
  reach: number;
  engaged_users: number;
  clicks: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reactions_breakdown: string | null; // JSON: {like: 10, love: 5, ...}
  last_updated: number;
}

export interface FacebookPostingSchedule {
  id: number;
  time_slot: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
  hour_utc: number; // 0-23
  minute: number; // 0-59
  preferred_content_types: string; // JSON array: ["business_spotlight", "category_highlight"]
  target_type: 'page' | 'group' | 'both';
  is_active: boolean;
  created_at: number;
}

export interface ContentGenerationContext {
  contentType: 'business_spotlight' | 'blog_share' | 'category_highlight' | 'engagement_prompt';
  targetType: 'page' | 'group' | 'both';
  business?: Business;
  blogPost?: BlogPost;
  category?: Category;
  siteUrl: string;
  utmCampaign: string;
}

export interface FacebookGraphAPIResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface FacebookPostInsights {
  post_impressions?: number;
  post_impressions_unique?: number;
  post_engaged_users?: number;
  post_clicks?: number;
  post_reactions_by_type_total?: {
    like?: number;
    love?: number;
    wow?: number;
    haha?: number;
    sad?: number;
    angry?: number;
  };
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  fan_count?: number;
  followers_count?: number;
}
