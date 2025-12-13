import { Env, Business, Category, AdPlacement, SearchParams, PaginatedResponse } from './types';
import { getFacebookImageUrl } from './utils';

export class DatabaseService {
  constructor(public db: D1Database) {}

  // Helper to enrich business with Facebook image URL
  private enrichBusinessWithFacebookImage(business: Business): Business {
    if (business.facebook_url && !business.image_url) {
      // Add facebook_image_url as a computed property
      (business as any).facebook_image_url = getFacebookImageUrl(business.facebook_url);
    }
    return business;
  }

  // Categories
  async getAllCategories(): Promise<Category[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM categories ORDER BY display_order, name')
      .all<Category>();
    return results || [];
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const result = await this.db
      .prepare('SELECT * FROM categories WHERE slug = ?')
      .bind(slug)
      .first<Category>();
    return result;
  }

  // Businesses
  async searchBusinesses(params: SearchParams): Promise<PaginatedResponse<Business>> {
    const { query, category, city, limit = 20, offset = 0 } = params;
    
    let sql = `
      SELECT b.* FROM businesses b
      WHERE b.is_active = 1
    `;
    const bindings: any[] = [];

    if (query) {
      sql += ` AND (b.name LIKE ? OR b.description LIKE ?)`;
      bindings.push(`%${query}%`, `%${query}%`);
    }

    if (category) {
      sql += ` AND b.category_id = (SELECT id FROM categories WHERE slug = ?)`;
      bindings.push(category);
    }

    if (city) {
      sql += ` AND LOWER(b.city) = LOWER(?)`;
      bindings.push(city);
    }

    // Get total count
    const countSql = sql.replace('SELECT b.*', 'SELECT COUNT(*) as total');
    const countResult = await this.db
      .prepare(countSql)
      .bind(...bindings)
      .first<{ total: number }>();
    
    const total = countResult?.total || 0;

    // Get paginated results
    sql += ` ORDER BY b.is_featured DESC, b.google_rating DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const { results } = await this.db
      .prepare(sql)
      .bind(...bindings)
      .all<Business>();

    return {
      data: (results || []).map(b => this.enrichBusinessWithFacebookImage(b)),
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  async getFeaturedBusinesses(limit: number = 6): Promise<Business[]> {
    const { results } = await this.db
      .prepare(`
        SELECT b.* FROM businesses b
        WHERE b.is_featured = 1 AND b.is_active = 1
        ORDER BY b.google_rating DESC, b.name
        LIMIT ?
      `)
      .bind(limit)
      .all<Business>();
    return (results || []).map(b => this.enrichBusinessWithFacebookImage(b));
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const result = await this.db
      .prepare('SELECT * FROM businesses WHERE slug = ? AND is_active = 1')
      .bind(slug)
      .first<Business>();
    return result ? this.enrichBusinessWithFacebookImage(result) : null;
  }

  async getBusinessesByCategory(categorySlug: string, limit: number = 20): Promise<Business[]> {
    const { results } = await this.db
      .prepare(`
        SELECT b.* FROM businesses b
        INNER JOIN categories c ON b.category_id = c.id
        WHERE c.slug = ? AND b.is_active = 1
        ORDER BY b.is_featured DESC, b.google_rating DESC
        LIMIT ?
      `)
      .bind(categorySlug, limit)
      .all<Business>();
    return (results || []).map(b => this.enrichBusinessWithFacebookImage(b));
  }

  // Ad Placements
  async getActiveAdPlacements(placementType: string): Promise<(AdPlacement & Business)[]> {
    const now = Math.floor(Date.now() / 1000);
    const { results } = await this.db
      .prepare(`
        SELECT a.*, b.* FROM ad_placements a
        INNER JOIN businesses b ON a.business_id = b.id
        WHERE a.placement_type = ? 
          AND a.is_active = 1 
          AND a.start_date <= ? 
          AND a.end_date >= ?
          AND b.is_active = 1
        ORDER BY a.position, a.created_at
      `)
      .bind(placementType, now, now)
      .all<AdPlacement & Business>();
    return results || [];
  }

  // Create business
  async createBusiness(business: Partial<Business>): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO businesses (
          name, slug, description, category_id, email, phone, website,
          address_line1, address_line2, city, state, zip_code,
          latitude, longitude, service_area,
          facebook_url, google_business_url, image_url,
          google_rating, google_review_count, facebook_rating, facebook_review_count,
          is_verified, is_featured, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        // Coerce undefined => null for D1 compatibility
        business.name ?? null,
        business.slug ?? null,
        business.description ?? null,
        (typeof business.category_id === 'number' ? business.category_id : (business.category_id ? Number(business.category_id) : null)),
        business.email ?? null,
        business.phone ?? null,
        business.website ?? null,
        business.address_line1 ?? null,
        business.address_line2 ?? null,
        business.city ?? null,
        business.state ?? null,
        business.zip_code ?? null,
        // latitude/longitude
        (typeof business.latitude === 'number' ? business.latitude : (business.latitude ? Number(business.latitude) : null)),
        (typeof business.longitude === 'number' ? business.longitude : (business.longitude ? Number(business.longitude) : null)),
        business.service_area ?? null,
        // social
        business.facebook_url ?? null,
        business.google_business_url ?? null,
        business.image_url ?? null,
        // ratings/reviews
        (typeof business.google_rating === 'number' ? business.google_rating : (business.google_rating ? Number(business.google_rating) : 0)),
        (typeof business.google_review_count === 'number' ? business.google_review_count : (business.google_review_count ? Number(business.google_review_count) : 0)),
        (typeof business.facebook_rating === 'number' ? business.facebook_rating : (business.facebook_rating ? Number(business.facebook_rating) : 0)),
        (typeof business.facebook_review_count === 'number' ? business.facebook_review_count : (business.facebook_review_count ? Number(business.facebook_review_count) : 0)),
        // flags
        business.is_verified ? 1 : 0,
        business.is_featured ? 1 : 0,
        business.is_active ? 1 : 0
      )
      .run();
    
    return result.meta.last_row_id as number;
  }

  // Business submissions
  async createBusinessSubmission(submission: Partial<any>): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO business_submissions (
          name, email, phone, category_id, description, 
          address, city, state, website, submission_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        submission.name,
        // Some submissions may provide a Facebook URL instead of an email.
        // The DB schema requires `email` to be non-null, so coalesce to empty string
        // to avoid SQLITE_CONSTRAINT NOT NULL failures. The full submitted data
        // (including facebook_url) is stored in `submission_data`.
        submission.email || '',
        submission.phone,
        submission.category_id,
        submission.description,
        submission.address,
        submission.city,
        submission.state,
        submission.website,
        JSON.stringify(submission)
      )
      .run();
    
    return result.meta.last_row_id as number;
  }

  // Get recent blog posts
  async getRecentBlogPosts(limit: number = 5): Promise<any[]> {
    const { results } = await this.db
      .prepare(`
        SELECT * FROM blog_posts
        WHERE is_published = 1
        ORDER BY publish_date DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();
    return results || [];
  }

  // Blog Management Methods
  async getAllBlogPosts(limit: number = 50, offset: number = 0, publishedOnly: boolean = false): Promise<any[]> {
    let sql = 'SELECT * FROM blog_posts';
    if (publishedOnly) {
      sql += ' WHERE is_published = 1';
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const { results } = await this.db
      .prepare(sql)
      .bind(limit, offset)
      .all();
    return results || [];
  }

  async getBlogPostById(id: number): Promise<any> {
    return await this.db
      .prepare('SELECT * FROM blog_posts WHERE id = ?')
      .bind(id)
      .first();
  }

  async getBlogPostBySlug(slug: string): Promise<any> {
    return await this.db
      .prepare('SELECT * FROM blog_posts WHERE slug = ?')
      .bind(slug)
      .first();
  }

  async createBlogPost(post: {
    business_id?: number;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featured_image?: string;
    author?: string;
    is_published?: boolean;
    publish_date?: number;
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db
      .prepare(`
        INSERT INTO blog_posts (
          business_id, title, slug, content, excerpt, featured_image,
          author, is_published, publish_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        post.business_id || null,
        post.title,
        post.slug,
        post.content,
        post.excerpt || null,
        post.featured_image || null,
        post.author || 'KiamichiBizConnect',
        post.is_published ? 1 : 0,
        post.publish_date || now,
        now,
        now
      )
      .run();

    return result.meta.last_row_id as number;
  }

  async updateBlogPost(id: number, updates: {
    business_id?: number;
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    author?: string;
    is_published?: boolean;
    publish_date?: number;
  }): Promise<void> {
    const keys: string[] = [];
    const values: any[] = [];

    if (updates.business_id !== undefined) { keys.push('business_id = ?'); values.push(updates.business_id); }
    if (updates.title !== undefined) { keys.push('title = ?'); values.push(updates.title); }
    if (updates.slug !== undefined) { keys.push('slug = ?'); values.push(updates.slug); }
    if (updates.content !== undefined) { keys.push('content = ?'); values.push(updates.content); }
    if (updates.excerpt !== undefined) { keys.push('excerpt = ?'); values.push(updates.excerpt); }
    if (updates.featured_image !== undefined) { keys.push('featured_image = ?'); values.push(updates.featured_image); }
    if (updates.author !== undefined) { keys.push('author = ?'); values.push(updates.author); }
    if (updates.is_published !== undefined) { keys.push('is_published = ?'); values.push(updates.is_published ? 1 : 0); }
    if (updates.publish_date !== undefined) { keys.push('publish_date = ?'); values.push(updates.publish_date); }

    if (keys.length === 0) return;

    keys.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));

    const sql = `UPDATE blog_posts SET ${keys.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.db.prepare(sql).bind(...values).run();
  }

  async deleteBlogPost(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
  }

  async toggleBlogPublishStatus(id: number): Promise<void> {
    const post = await this.getBlogPostById(id);
    if (!post) return;

    const newStatus = post.is_published ? 0 : 1;
    const publishDate = newStatus === 1 ? Math.floor(Date.now() / 1000) : post.publish_date;

    await this.db
      .prepare('UPDATE blog_posts SET is_published = ?, publish_date = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, publishDate, Math.floor(Date.now() / 1000), id)
      .run();
  }

  // Stats
  async getStats(): Promise<any> {
    const businessCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM businesses WHERE is_active = 1')
      .first<{ count: number }>();

    const categoryCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM categories')
      .first<{ count: number }>();

    const cityCount = await this.db
      .prepare('SELECT COUNT(DISTINCT city) as count FROM businesses WHERE is_active = 1')
      .first<{ count: number }>();

    return {
      businesses: businessCount?.count || 0,
      categories: categoryCount?.count || 0,
      cities: cityCount?.count || 0
    };
  }

  // Lead Generation
  async createContactLead(lead: {
    business_id: number;
    name: string;
    email: string;
    phone?: string;
    service_requested?: string;
    message?: string;
    urgency?: string;
    preferred_contact_method?: string;
  }): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO contact_leads (
          business_id, name, email, phone, service_requested,
          message, urgency, preferred_contact_method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
      `)
      .bind(
        lead.business_id,
        lead.name,
        lead.email,
        lead.phone || null,
        lead.service_requested || null,
        lead.message || null,
        lead.urgency || 'medium',
        lead.preferred_contact_method || 'email'
      )
      .run();

    return result.meta.last_row_id as number;
  }

  async getBusinessLeadSubscription(businessId: number): Promise<any> {
    const result = await this.db
      .prepare('SELECT * FROM lead_subscriptions WHERE business_id = ?')
      .bind(businessId)
      .first();
    return result;
  }

  async getPendingLeads(limit: number = 50): Promise<any[]> {
    const { results } = await this.db
      .prepare(`
        SELECT
          cl.*,
          b.name as business_name,
          b.slug as business_slug,
          ls.tier as subscription_tier,
          ls.auto_forward_email,
          ls.notification_email
        FROM contact_leads cl
        JOIN businesses b ON cl.business_id = b.id
        LEFT JOIN lead_subscriptions ls ON b.id = ls.business_id
        WHERE cl.status = 'new'
        ORDER BY cl.created_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();
    return results || [];
  }

  // Update an existing business record with partial fields
  async updateBusiness(id: number, updates: Partial<Business>): Promise<void> {
    const keys: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { keys.push('name = ?'); values.push(updates.name); }
    if (updates.slug !== undefined) { keys.push('slug = ?'); values.push(updates.slug); }
    if (updates.description !== undefined) { keys.push('description = ?'); values.push(updates.description); }
    if (updates.category_id !== undefined) { keys.push('category_id = ?'); values.push(updates.category_id); }
    if (updates.email !== undefined) { keys.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { keys.push('phone = ?'); values.push(updates.phone); }
    if (updates.website !== undefined) { keys.push('website = ?'); values.push(updates.website); }
    if (updates.address_line1 !== undefined) { keys.push('address_line1 = ?'); values.push(updates.address_line1); }
    if (updates.address_line2 !== undefined) { keys.push('address_line2 = ?'); values.push(updates.address_line2); }
    if (updates.city !== undefined) { keys.push('city = ?'); values.push(updates.city); }
    if (updates.state !== undefined) { keys.push('state = ?'); values.push(updates.state); }
    if (updates.zip_code !== undefined) { keys.push('zip_code = ?'); values.push(updates.zip_code); }
    if (updates.image_url !== undefined) { keys.push('image_url = ?'); values.push(updates.image_url); }
    if (updates.is_active !== undefined) { keys.push('is_active = ?'); values.push(updates.is_active ? 1 : 0); }
    if (updates.is_featured !== undefined) { keys.push('is_featured = ?'); values.push(updates.is_featured ? 1 : 0); }

    if (updates.latitude !== undefined) { keys.push('latitude = ?'); values.push(updates.latitude); }
    if (updates.longitude !== undefined) { keys.push('longitude = ?'); values.push(updates.longitude); }
    if (updates.service_area !== undefined) { keys.push('service_area = ?'); values.push(updates.service_area); }
    if (updates.facebook_url !== undefined) { keys.push('facebook_url = ?'); values.push(updates.facebook_url); }
    if (updates.google_business_url !== undefined) { keys.push('google_business_url = ?'); values.push(updates.google_business_url); }
    if (updates.google_rating !== undefined) { keys.push('google_rating = ?'); values.push(updates.google_rating); }
    if (updates.google_review_count !== undefined) { keys.push('google_review_count = ?'); values.push(updates.google_review_count); }
    if (updates.facebook_rating !== undefined) { keys.push('facebook_rating = ?'); values.push(updates.facebook_rating); }
    if (updates.facebook_review_count !== undefined) { keys.push('facebook_review_count = ?'); values.push(updates.facebook_review_count); }
    if (updates.is_verified !== undefined) { keys.push('is_verified = ?'); values.push(updates.is_verified ? 1 : 0); }

    if (keys.length === 0) return;

    const sql = `UPDATE businesses SET ${keys.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.db.prepare(sql).bind(...values).run();
  }

  // Delete a business by id
  async deleteBusiness(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM businesses WHERE id = ?').bind(id).run();
  }
}
