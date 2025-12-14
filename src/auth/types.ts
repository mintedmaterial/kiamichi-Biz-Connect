/**
 * Authentication Types for KiamichiBizConnect
 * Supports Google OAuth (admin) and Facebook OAuth (businesses)
 */

export interface AdminSession {
  id: string;              // UUID session ID
  user_email: string;      // Google email
  user_name: string | null;
  user_picture: string | null;
  created_at: number;      // Unix timestamp
  expires_at: number;      // Unix timestamp
  last_activity: number;   // Unix timestamp
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
  refresh_token?: string;
}

export interface GoogleUserInfo {
  sub: string;             // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

export interface FacebookAuth {
  id: number;
  business_id: number;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  access_token: string;
  token_expires_at: number | null;
  scopes: string | null;
  connected_at: number;
  last_refreshed: number;
}

export interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookPageData {
  id: string;              // Page ID
  name: string;            // Page name
  access_token: string;    // Page access token (never expires)
  category: string;
  picture?: {
    data: {
      url: string;
    };
  };
  cover?: {
    source: string;
  };
}

export interface FacebookUserPages {
  data: FacebookPageData[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

export interface AuthResult {
  authorized: boolean;
  session?: AdminSession;
  error?: string;
}
